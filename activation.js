/* Stable-release activation. Client-side deterrent, not tamper-resistant licensing. */
const CA_LOCK_RELEASE='0.4.15';
const CA_LOCK_KEY='card-archive-activation-'+CA_LOCK_RELEASE;
const CA_LOCK_SALT='9hGC1Ak16TAOHibyuuNQpw==';
const CA_LOCK_HASH='db+tMR2IVI6rGB8DwpkwTl5hTaGvbTT84d06HpeI4yw=';
const CA_LOCK_ITERATIONS=220000;
function caLockStatus(){try{return localStorage.getItem(CA_LOCK_KEY)||''}catch{return ''}}
function caLockStore(status){try{localStorage.setItem(CA_LOCK_KEY,status);return true}catch{return false}}
async function caVerifyPassword(value){
 if(!crypto?.subtle)return false;
 const encoder=new TextEncoder();const salt=Uint8Array.from(atob(CA_LOCK_SALT),x=>x.charCodeAt(0));
 const key=await crypto.subtle.importKey('raw',encoder.encode(value),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:CA_LOCK_ITERATIONS,hash:'SHA-256'},key,256);
 const expected=Uint8Array.from(atob(CA_LOCK_HASH),x=>x.charCodeAt(0));const actual=new Uint8Array(bits);
 let diff=0;for(let i=0;i<expected.length;i++)diff|=expected[i]^actual[i];return diff===0;
}
function caLockScreen(){
 const root=document.getElementById('caActivationRoot');if(!root)return;
 const status=caLockStatus();if(status==='activated'||status==='removed'){root.remove();return}
 root.innerHTML=`<div class="caActivationDialog" role="dialog" aria-modal="true" aria-labelledby="caActivationHeading"><div class="caActivationBrand">CARD ARCHIVE / V0.4.15<span class="caActivationAuthor">noelgato-dll</span></div><h2 id="caActivationHeading">Activation Required</h2><p>Enter the password for this stable release.</p><form id="caActivationForm"><input aria-label="Release password" id="caActivationPassword" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" required maxlength="20" /><p id="caActivationError" role="alert" aria-live="polite"></p><button type="submit">Confirm</button></form></div>`;
 const input=document.getElementById('caActivationPassword');input.focus();
 document.getElementById('caActivationForm').onsubmit=async e=>{
 e.preventDefault();const btn=e.target.querySelector('button');btn.disabled=true;const err=document.getElementById('caActivationError');err.textContent='';
 try{const ok=await caVerifyPassword(input.value);if(ok){if(!caLockStore('activated')){err.textContent='Unable to save activation on this device. Check browser storage settings.';return}root.remove();return}err.textContent='Incorrect activation password.';input.value='';input.focus()}
 catch(_){err.textContent='Unable to verify password on this device.'}finally{btn.disabled=false}
 };
}
caLockScreen();
