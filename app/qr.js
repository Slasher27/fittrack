/* ---------- QR encoder (vanilla, byte mode, ECC level L, versions 1–10) ----------
   Powers "Link another device": new devices scan a QR instead of typing sync
   credentials. Hand-written to keep the zero-dependency rule; output is
   verified against the jsQR decoder in the test battery. */
const QR_ECL=[ // per version (1..10) at ECC L: [data codewords, ecc per block, [[numBlocks, dataPerBlock],…]]
  [19,7,[[1,19]]],[34,10,[[1,34]]],[55,15,[[1,55]]],[80,20,[[1,80]]],[108,26,[[1,108]]],
  [136,18,[[2,68]]],[156,20,[[2,78]]],[194,24,[[2,97]]],[232,30,[[2,116]]],[274,18,[[2,68],[2,69]]]];
const QR_ALIGN=[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50]];
const GEXP=new Array(512),GLOG=new Array(256);
(()=>{let x=1;for(let i=0;i<255;i++){GEXP[i]=x;GLOG[x]=i;x<<=1;if(x&0x100)x^=0x11d;}for(let i=255;i<512;i++)GEXP[i]=GEXP[i-255];})();
function rsGen(n){let g=[1];for(let i=0;i<n;i++){const ng=new Array(g.length+1).fill(0);
  for(let j=0;j<g.length;j++){ng[j]^=g[j];ng[j+1]^=g[j]?GEXP[(GLOG[g[j]]+i)%255]:0;}g=ng;}return g;}
function rsEcc(data,n){const gen=rsGen(n),res=data.concat(new Array(n).fill(0));
  for(let i=0;i<data.length;i++){const f=res[i];if(!f)continue;const lf=GLOG[f];
    for(let j=0;j<gen.length;j++)if(gen[j])res[i+j]^=GEXP[(lf+GLOG[gen[j]])%255];}
  return res.slice(data.length);}
function bchDigit(d){let n=0;while(d){n++;d>>>=1;}return n;}
function bch15(data){const G=0b10100110111;let d=data<<10;while(bchDigit(d)>=11)d^=G<<(bchDigit(d)-11);return ((data<<10)|d)^0b101010000010010;}
function bch18(ver){const G=0b1111100100101;let d=ver<<12;while(bchDigit(d)>=13)d^=G<<(bchDigit(d)-13);return (ver<<12)|d;}
function qrMatrix(text){
  const bytes=[...new TextEncoder().encode(text)];
  let ver=0;
  for(let v=1;v<=10&&!ver;v++)if(Math.ceil((4+(v<10?8:16)+bytes.length*8)/8)<=QR_ECL[v-1][0])ver=v;
  if(!ver)throw new Error('QR payload too long');
  const size=17+4*ver;
  const mod=Array.from({length:size},()=>new Array(size).fill(0));
  const used=Array.from({length:size},()=>new Array(size).fill(false));
  const set=(r,c,v)=>{mod[r][c]=v?1:0;used[r][c]=true;};
  const finder=(r,c)=>{for(let i=-1;i<8;i++)for(let j=-1;j<8;j++){const rr=r+i,cc=c+j;
    if(rr<0||cc<0||rr>=size||cc>=size)continue;
    set(rr,cc,i>=0&&i<=6&&j>=0&&j<=6&&(i===0||i===6||j===0||j===6||(i>=2&&i<=4&&j>=2&&j<=4)));}};
  finder(0,0);finder(0,size-7);finder(size-7,0);
  for(let i=8;i<size-8;i++){if(!used[6][i])set(6,i,i%2===0);if(!used[i][6])set(i,6,i%2===0);}
  const last=size-7;
  for(const r of QR_ALIGN[ver-1])for(const c of QR_ALIGN[ver-1]){
    if((r===6&&c===6)||(r===6&&c===last)||(r===last&&c===6))continue;
    for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++)set(r+i,c+j,Math.max(Math.abs(i),Math.abs(j))!==1);
  }
  set(size-8,8,1); // fixed dark module
  for(let i=0;i<9;i++){if(!used[8][i])set(8,i,0);if(!used[i][8])set(i,8,0);} // reserve format areas
  for(let i=0;i<8;i++){if(!used[8][size-1-i])set(8,size-1-i,0);if(!used[size-1-i][8])set(size-1-i,8,0);}
  if(ver>=7)for(let i=0;i<18;i++){set(Math.floor(i/3),i%3+size-11,0);set(i%3+size-11,Math.floor(i/3),0);}
  // data bits: mode 0100 + count + bytes, terminator, pad to capacity
  const info=QR_ECL[ver-1],buf=[];
  const push=(val,n)=>{for(let i=n-1;i>=0;i--)buf.push((val>>i)&1);};
  push(4,4);push(bytes.length,ver<10?8:16);
  for(const b of bytes)push(b,8);
  const cap=info[0]*8;
  push(0,Math.min(4,cap-buf.length));
  while(buf.length%8)buf.push(0);
  for(let p=0;buf.length<cap;p++)push(p%2?0x11:0xEC,8);
  const data=[];for(let i=0;i<buf.length;i+=8){let v=0;for(let j=0;j<8;j++)v=(v<<1)|buf[i+j];data.push(v);}
  // split into blocks, append Reed-Solomon ecc, interleave
  const blocks=[];let off=0;
  for(const [nb,dl] of info[2])for(let b=0;b<nb;b++){blocks.push(data.slice(off,off+dl));off+=dl;}
  const eccs=blocks.map(b=>rsEcc(b,info[1]));
  const seq=[];
  for(let i=0;i<Math.max(...blocks.map(b=>b.length));i++)for(const b of blocks)if(i<b.length)seq.push(b[i]);
  for(let i=0;i<info[1];i++)for(const e of eccs)seq.push(e[i]);
  const dbits=[];for(const cw of seq)for(let i=7;i>=0;i--)dbits.push((cw>>i)&1);
  // zigzag placement, mask pattern 0
  let bi=0,up=true;
  for(let col=size-1;col>0;col-=2){
    if(col===6)col--;
    for(let k=0;k<size;k++){
      const r=up?size-1-k:k;
      for(let d2=0;d2<2;d2++){
        const c=col-d2;
        if(used[r][c])continue;
        let v=bi<dbits.length?dbits[bi]:0;bi++;
        if((r+c)%2===0)v^=1;
        mod[r][c]=v;
      }
    }
    up=!up;
  }
  // format info: ECC L (01) + mask 0
  const fmt=bch15(0b01<<3);
  for(let i=0;i<15;i++){
    const on=(fmt>>i)&1;
    if(i<6)mod[i][8]=on;else if(i<8)mod[i+1][8]=on;else mod[size-15+i][8]=on;
    if(i<8)mod[8][size-1-i]=on;else if(i<9)mod[8][7]=on;else mod[8][14-i]=on;
  }
  if(ver>=7){const vi=bch18(ver);
    for(let i=0;i<18;i++){const on=(vi>>i)&1;mod[Math.floor(i/3)][i%3+size-11]=on;mod[i%3+size-11][Math.floor(i/3)]=on;}}
  return mod;
}
function drawQR(canvas,text){
  const m=qrMatrix(text),n=m.length,q=4,s=Math.max(3,Math.floor(300/(n+2*q)));
  canvas.width=canvas.height=(n+2*q)*s;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height); // white quiet zone — scanners need it even in dark theme
  ctx.fillStyle='#000';
  for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(m[r][c])ctx.fillRect((c+q)*s,(r+q)*s,s,s);
}

