from PIL import Image, ImageDraw, ImageFont
C="captures/"; IDS=["educational","engineering","playground","creative","experience"]
F=ImageFont.truetype("segoeui.ttf",15); B=ImageFont.truetype("segoeui.ttf",22)
def sheet(kind,cols,w,out,title):
    rows=[]
    for i in IDS:
        ims=[Image.open(f"{C}{kind}-{i}-{c}.png").convert("RGB") for c,_ in cols]
        h=round(w*ims[0].height/ims[0].width); rows.append((i,[m.resize((w,h),Image.LANCZOS) for m in ims],h))
    H=60+sum(h+34 for _,_,h in rows); S=Image.new("RGB",(len(cols)*(w+8)+8,H),(14,16,20)); d=ImageDraw.Draw(S); d.text((8,14),title,font=B,fill=(235,235,235)); y=56
    for i,ims,h in rows:
        for k,m in enumerate(ims):
            x=8+k*(w+8); d.text((x,y+4),f"{i}: {cols[k][1]}",font=F,fill=(205,210,216)); S.paste(m,(x,y+26))
        y+=h+34
    S.save(out,optimize=True); print(S.size)
sheet("line",[("rest","rest"),("charge-50","charging"),("arrived","arrived"),("powered","powered"),("return-600","returning +600"),("returned","returned")],420,"../connection-closeups.png","M1.4I  Connections, 3x: rest, charging, arrived, powered, returning, returned")
sheet("end",[("rest","rest"),("before-arrival","spark arriving"),("lift-mid","+180 ms"),("powered","powered"),("return-200","returning +200"),("returned","returned")],380,"../connection-ends.png","M1.4I  Where each connection meets its platform, 8x")
sheet("start",[("rest","rest"),("charge-25","charging"),("powered","powered"),("return-800","returning +800")],380,"../connection-starts.png","M1.4I  Where each connection leaves the central A, 8x")
