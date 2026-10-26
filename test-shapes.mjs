import { Shapes } from '@desert-ant-labs/shapes/native';
const shapes = await Shapes.load({ onProgress: (p) => process.stdout.write(`\r${(p*100).toFixed(0)}%`) });
console.log('\nloaded');
const circle = [];
for (let i = 0; i < 40; i++) {
  const a = (i / 40) * Math.PI * 2;
  circle.push({ x: 200 + Math.cos(a) * 80 + (Math.random()-0.5)*3, y: 200 + Math.sin(a) * 60 + (Math.random()-0.5)*3 });
}
console.log(JSON.stringify(await shapes.recognize(circle), null, 1));
const rect = [{x:50,y:50},{x:220,y:54},{x:218,y:160},{x:52,y:157},{x:50,y:50}];
console.log(JSON.stringify(await shapes.recognize(rect), null, 1));
const star = [];
for (let i = 0; i < 10; i++) {
  const a = -Math.PI/2 + i * Math.PI/5;
  const r = i % 2 === 0 ? 80 : 35;
  star.push({x: 300 + Math.cos(a)*r, y: 300 + Math.sin(a)*r});
}
star.push(star[0]);
console.log(JSON.stringify(await shapes.recognize(star), null, 1));
shapes.dispose();
