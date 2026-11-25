import glob,os,numpy as np
from PIL import Image
L=lambda d,n: np.asarray(Image.open(f"cap/j2/{d}/{n}").convert("RGB")).astype(int)
for f in sorted(glob.glob("cap/j2/lo-base0/*.png")):
    n=os.path.basename(f); B=[L("lo-base0",n),L("lo-base1",n)]; N=[L("lo-now0",n),L("lo-now1",n)]
    def q(a,b):
        d=np.abs(a-b).max(-1); d[285:555,1035:1370]=0; ys,xs=np.nonzero(d>2); return (int(d.max()),len(ys),(int(xs.min()),int(ys.min()),int(xs.max()),int(ys.max())) if len(ys) else None)
    print(n.ljust(22),"now vs base",q(N[0],B[0]),q(N[1],B[1]),"| base noise",q(B[0],B[1])[:2],"| now noise",q(N[0],N[1])[:2])
