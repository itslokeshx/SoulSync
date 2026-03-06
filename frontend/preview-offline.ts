import { Capacitor } from "@capacitor/core";
console.log("Mocking native platform for offline preview...");
// @ts-ignore
Capacitor.isNativePlatform = () => true;
// @ts-ignore
Capacitor.getPlatform = () => "android";
