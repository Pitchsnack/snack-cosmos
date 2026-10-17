import {useEffect} from 'react';
import {useServerFn} from '@tanstack/react-start';
import {useSessionContext} from './use-session-context';
import {recordSignInDay} from '@/lib/analytics.functions';
import {bkkDay} from '@/lib/analytics';
export function SignInDayRecorder(){
 const {data}=useSessionContext();const record=useServerFn(recordSignInDay);
 useEffect(()=>{let busy=false;const userId=data?.user.id;if(!userId)return;const check=async()=>{if(document.visibilityState==='hidden'||busy)return;const day=bkkDay(),key=`pitchsnack.sign-in-day.${userId}`;try{if(localStorage.getItem(key)===day)return;}catch{}busy=true;try{const result=await record();if(result.recorded||result.day===day){try{localStorage.setItem(key,result.day);}catch{}}}catch{}finally{busy=false;}};void check();window.addEventListener('focus',check);document.addEventListener('visibilitychange',check);const timer=window.setInterval(check,60000);return()=>{window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',check);clearInterval(timer);};},[data?.user.id,record]);return null;
}