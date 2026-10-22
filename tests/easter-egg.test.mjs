import test from 'node:test';
import assert from 'node:assert/strict';
import {albumPhotos,matchesSecretCode,albumIndex} from '../easter-egg.mjs';
import {access} from 'node:fs/promises';
test('secret code accepts case and surrounding spaces but requires a complete code',()=>{
 for(const code of ['CHIIKAWA','chiikawa','  ChiiKawa  '])assert.equal(matchesSecretCode(code),true);
 for(const code of ['',null,'CHIKAWA','CHIIKAWA123','CHII KAWA'])assert.equal(matchesSecretCode(code),false);
});
test('album cycles in both directions, and every photograph is bundled locally',async()=>{
 assert.equal(albumIndex(-1),10);assert.equal(albumIndex(11),0);assert.equal(albumIndex(22),0);
 for(const photo of albumPhotos)await access(new URL('../'+photo,import.meta.url));
});
