#!/bin/sh
# Télécharge three.js r128 + GLTFLoader (utilisés uniquement par tools/render.html).
cd "$(dirname "$0")"
curl -sSfo three.min.js https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
curl -sSfo GLTFLoader.js https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js
