# Gümüş disko topu GLB (test varlığı): ayna kareler + koyu derz küresi + askı
import math, struct, json, sys
def norm(v):
    l=math.sqrt(sum(c*c for c in v)); return [c/l for c in v]
def sph(r,lat,lon): return [r*math.cos(lat)*math.sin(lon), r*math.sin(lat), r*math.cos(lat)*math.cos(lon)]
meshes=[]  # (positions, normals, indices, material)
# 1) ayna kareler
P=[];N=[];I=[]
R=1.0; bands=26; gap=0.13
for b in range(bands):
    la0=-math.pi/2+math.pi*b/bands; la1=la0+math.pi/bands
    lc=(la0+la1)/2; n=max(4,int(round(2*bands*math.cos(lc))))
    dla=(la1-la0)*gap/2
    for k in range(n):
        lo0=2*math.pi*k/n; lo1=lo0+2*math.pi/n; dlo=(lo1-lo0)*gap/2
        if b in (0,bands-1):  # kutup: tek düz ayna kapak (alt kutupta koyu delik kalmasın)
            if k == 0:
                la = la1 - dla if b == 0 else la0 + dla
                ring=[sph(R,la,2*math.pi*j/12) for j in range(12)]
                cy=sum(p[1] for p in ring)/12; nn=[0,-1 if b==0 else 1,0]
                base=len(P); P.append([0,cy,0]); N.append(nn)
                for p in ring: P.append([p[0],cy,p[2]]); N.append(nn)
                for j in range(12):
                    a2,b2=base+1+j, base+1+(j+1)%12
                    I.extend([base,b2,a2] if b==0 else [base,a2,b2])
            continue
        q=[sph(R,la0+dla,lo0+dlo),sph(R,la0+dla,lo1-dlo),sph(R,la1-dla,lo1-dlo),sph(R,la1-dla,lo0+dlo)]
        c=[sum(p[i] for p in q)/4 for i in range(3)]; nn=norm(c)
        # kareyi düz yap: köşeleri merkez düzlemine izdüşür (her ayna düz bir yüz)
        d=sum(c[i]*nn[i] for i in range(3))
        q=[[p[i]-(sum(p[j]*nn[j] for j in range(3))-d)*nn[i] for i in range(3)] for p in q]
        base=len(P)
        for p in q: P.append(p); N.append(nn)
        I+= [base,base+1,base+2, base,base+2,base+3]
meshes.append((P,N,I,0))
# 2) derz küresi (koyu)
P=[];N=[];I=[]; rr=0.975; S=32
for i in range(S+1):
    la=-math.pi/2+math.pi*i/S
    for j in range(S+1):
        lo=2*math.pi*j/S; p=sph(rr,la,lo); P.append(p); N.append(norm(p))
for i in range(S):
    for j in range(S):
        a=i*(S+1)+j; b=a+S+1
        I+=[a,b,a+1, a+1,b,b+1]
meshes.append((P,N,I,1))
# 3) askı: tepe kapağı (silindir) + halka (torus)
P=[];N=[];I=[]
def cyl(r,y0,y1,seg=24):
    base=len(P)
    for k in range(seg+1):
        a=2*math.pi*k/seg; x=r*math.sin(a); z=r*math.cos(a); nn=[math.sin(a),0,math.cos(a)]
        P.append([x,y0,z]);N.append(nn);P.append([x,y1,z]);N.append(nn)
    for k in range(seg):
        a=base+2*k; I.extend([a,a+2,a+1, a+1,a+2,a+3])
    c=len(P); P.append([0,y1,0]); N.append([0,1,0])
    for k in range(seg+1):
        a=2*math.pi*k/seg; P.append([r*math.sin(a),y1,r*math.cos(a)]); N.append([0,1,0])
    for k in range(seg): I.extend([c,c+1+k,c+2+k])
cyl(0.16,0.93,1.06)
def torus(R0,r0,cy,seg=32,tub=12):
    base=len(P)
    for i in range(seg+1):
        u=2*math.pi*i/seg
        for j in range(tub+1):
            v=2*math.pi*j/tub
            cx=R0*math.cos(u); cyy=cy+R0*math.sin(u)
            nx=math.cos(v)*math.cos(u); ny=math.cos(v)*math.sin(u); nz=math.sin(v)
            P.append([cx+r0*nx, cyy+r0*ny, r0*nz]); N.append([nx,ny,nz])
    for i in range(seg):
        for j in range(tub):
            a=base+i*(tub+1)+j; b=a+tub+1
            I.extend([a,b,a+1, a+1,b,b+1])
torus(0.09,0.022,1.15)
meshes.append((P,N,I,2))

bin_=bytearray(); views=[]; acc=[]; prims=[]
def add(data,fmt,target):
    while len(bin_)%4: bin_.append(0)
    off=len(bin_); bin_.extend(struct.pack("<%d%s"%(len(data),fmt),*data))
    views.append({"buffer":0,"byteOffset":off,"byteLength":len(bin_)-off,"target":target}); return len(views)-1
for (P,N,I,m) in meshes:
    fp=[c for p in P for c in p]; fn=[c for n in N for c in n]
    vp=add(fp,"f",34962); vn=add(fn,"f",34962); vi=add(I,"I",34963)
    mn=[min(p[i] for p in P) for i in range(3)]; mx=[max(p[i] for p in P) for i in range(3)]
    acc.append({"bufferView":vp,"componentType":5126,"count":len(P),"type":"VEC3","min":mn,"max":mx})
    acc.append({"bufferView":vn,"componentType":5126,"count":len(N),"type":"VEC3"})
    acc.append({"bufferView":vi,"componentType":5125,"count":len(I),"type":"SCALAR"})
    k=len(acc)
    prims.append({"attributes":{"POSITION":k-3,"NORMAL":k-2},"indices":k-1,"material":m})
mats=[
 {"name":"Ayna","pbrMetallicRoughness":{"baseColorFactor":[0.93,0.94,0.96,1],"metallicFactor":1.0,"roughnessFactor":0.12}},
 {"name":"Derz","pbrMetallicRoughness":{"baseColorFactor":[0.06,0.06,0.07,1],"metallicFactor":0.3,"roughnessFactor":0.7}},
 {"name":"Aski","pbrMetallicRoughness":{"baseColorFactor":[0.8,0.81,0.84,1],"metallicFactor":1.0,"roughnessFactor":0.3}}]
gl={"asset":{"version":"2.0","generator":"Studio SEOZ test — disko topu"},"scene":0,"scenes":[{"nodes":[0]}],
    "nodes":[{"name":"DiskoTopu","mesh":0}],"meshes":[{"name":"DiskoTopu","primitives":prims}],
    "materials":mats,"accessors":acc,"bufferViews":views,"buffers":[{"byteLength":len(bin_)}]}
while len(bin_)%4: bin_.append(0)
js=json.dumps(gl,separators=(",",":")).encode()
while len(js)%4: js+=b" "
out=struct.pack("<III",0x46546C67,2,12+8+len(js)+8+len(bin_))+struct.pack("<II",len(js),0x4E4F534A)+js+struct.pack("<II",len(bin_),0x004E4942)+bytes(bin_)
open(sys.argv[1],"wb").write(out)
print("tris",sum(len(m[2])//3 for m in meshes),"bytes",len(out))
