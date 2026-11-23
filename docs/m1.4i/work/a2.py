"""Station captures: what changes between idle and each station's powered / before-arrival / returned scene, and where."""
import json, numpy as np
from PIL import Image
C="captures/"
K=928/941; X0=(1648-1672*K)/2
IDS=["engineering","educational","playground","creative","experience"]
BOX={"engineering":(225,315,640,675),"educational":(640,215,1035,590),"playground":(1030,310,1440,620),"creative":(15,500,600,910),"experience":(1020,500,1672,920)}
a=lambda n:np.asarray(Image.open(C+n).convert("RGB")).astype(int)
ys,xs=np.mgrid[0:928,0:1648]; SX=(xs+.5-X0)/K; SY=(ys+.5)/K
box=lambda b:(SX>=b[0])&(SX<b[2])&(SY>=b[1])&(SY<b[3])
hub=box((600,500,1080,680)); steam=box((220,700,350,800))
idle=a("full-idle.png"); out={}
for i in IDS:
    p=np.abs(a(f"full-powered-{i}.png")-idle).max(2); r=np.abs(a(f"full-returned-{i}.png")-idle).max(2)
    own=box(BOX[i]); rest=~own&~hub
    o={"powered: px changed over 4 (own box)":int((p>4)[own].sum()),"powered: px over 2 outside own box and the hub":int((p>2)[rest].sum()),"max there":int(p[rest].max()),
       "returned vs idle: max, px over 2":[int(r.max()),int((r>2).sum())]}
    for j in IDS:
        if j!=i: 
            m=box(BOX[j])&~own; o.setdefault("over 2 in other stations' boxes",{})[j]=int((p>2)[m].sum())
    d=np.abs(a(f"full-before-arrival-{i}.png")-a(f"full-seek-rest-{i}.png")).max(2)
    # the station's own artwork (its box without its label/icon/chips and the connection corridor)
    ky,kx=np.nonzero((d>4)&own); o["before arrival: px over 4 in own box"]=len(kx); 
    if len(kx): o["before arrival: where (scene px)"]=[round(float(SX[0,kx.min()])),round(float(SY[ky.min(),0])),round(float(SX[0,kx.max()])),round(float(SY[ky.max(),0]))]
    out[i]=o
    if rest.any() and (p>2)[rest].any():
        yy,xx=np.nonzero((p>2)&rest); out[i]["outside where"]=[round(float(SX[0,xx.min()])),round(float(SY[yy.min(),0])),round(float(SX[0,xx.max()])),round(float(SY[yy.max(),0]))]
json.dump(out,open("stations-diff.json","w"),indent=1); print(json.dumps(out,indent=None).replace("}, \"","},\n\""))
