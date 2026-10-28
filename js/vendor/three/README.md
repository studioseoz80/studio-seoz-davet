# Three.js (r170) — yerel kopya

Studio SEOZ "3D Model" katmanı için. Kaynak: https://github.com/mrdoob/three.js (etiket `r170`, commit `beab9e8`).
Lisans: MIT (bkz. LICENSE). Dosyalar değiştirilmeden alınmıştır; yalnızca `from 'three'` içe aktarmaları
aynı klasördeki `./three.module.min.js` dosyasına yönlendirilmiştir.

- three.module.min.js — 3D motoru
- GLTFLoader.js (+ BufferGeometryUtils.js) — GLB / glTF okuyucu
- RoomEnvironment.js — metal yüzeyler için yansıma ortamı

Bu dosyalar YALNIZCA sahnede 3D model varsa yüklenir (js/core/model3d.js, dinamik import).
