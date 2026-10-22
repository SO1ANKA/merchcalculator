export const albumPhotos=Array.from({length:11},(_,i)=>`./assets/chiikawa/${String(i+1).padStart(2,'0')}.jpg`);
export const matchesSecretCode=value=>String(value??'').trim().toUpperCase()==='CHIIKAWA';
export const albumIndex=value=>((Math.trunc(Number(value)||0)%albumPhotos.length)+albumPhotos.length)%albumPhotos.length;
