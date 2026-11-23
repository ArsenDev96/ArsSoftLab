"""How much of each station's visible artwork its hotspot covers (scene px)."""
import re, json, numpy as np
from PIL import Image, ImageDraw
R="D:/ArsSoftLab/"
src=open(R+"components/lab/scene-layout.ts",encoding="utf-8").read()
data=open(R+"components/lab/scene-v2-data.ts",encoding="utf-8").read()
objs=json.loads(re.search(r"V2_OBJECTS[^=]*= (\[.*?\]);",data,re.S).group(1))
pg=next(o for o in objs if o["id"]=="playground")
def alpha(i):
    if i=="playground":
        im=Image.open(R+"public"+pg["src"]).convert("RGBA").split()[3]
        w,h=1672,941
        out=Image.new("L",(w,h))
        s=pg["scale"]; im2=im.resize((round(1672*s),round(941*s)),Image.BILINEAR); out.paste(im2,(round(pg["tx"]),round(pg["ty"])))
        return np.asarray(out)
    f={"creative":"m14f/creative","experience":"m14f/experience","engineering":"m14f1/engineering","educational":"m14f1/educational"}[i]
    return np.asarray(Image.open(R+f"public/scene/v2/{f}.png").convert("RGBA"))[...,3]
out={}
for i in ["engineering","educational","playground","creative","experience"]:
    m=re.search(i+r": \{\s*label.*?hotspot: poly\(([^)]*)\)",src,re.S) or re.search(i+r": \{.*?hotspot: (?:poly\(([^)]*)\)|\{[^}]*\})",src,re.S)
    nums=[float(v) for v in m.group(1).split(",") if v.strip()]
    p=list(zip(nums[::2],nums[1::2])); im=Image.new("L",(1672,941)); ImageDraw.Draw(im).polygon(p,fill=255); H=np.asarray(im)>0
    A=alpha(i)>128
    un=A&~H; ys,xs=np.nonzero(un)
    out[i]=dict(artwork_px=int(A.sum()),covered=round(float((A&H).sum()/A.sum()),3),hotspot_px=int(H.sum()),hotspot_off_artwork=round(float((H&~A).sum()/H.sum()),3),hotspot_bbox=[int(min(a for a,_ in p)),int(min(b for _,b in p)),int(max(a for a,_ in p)),int(max(b for _,b in p))],artwork_bbox=[int(np.nonzero(A)[1].min()),int(np.nonzero(A)[0].min()),int(np.nonzero(A)[1].max()),int(np.nonzero(A)[0].max())])
    V=np.dstack([un*255,(A&H)*160,(H&~A)*255]).astype(np.uint8); Image.fromarray(V).crop((max(0,out[i]["artwork_bbox"][0]-20),out[i]["artwork_bbox"][1]-20,out[i]["artwork_bbox"][2]+20,out[i]["artwork_bbox"][3]+20)).save(R+f"docs/m1.4i/work/hit-{i}.png")
json.dump(out,open(R+"docs/m1.4i/work/hit.json","w"),indent=1); print(json.dumps(out).replace("}, ","},\n"))
