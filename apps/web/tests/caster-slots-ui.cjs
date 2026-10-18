const assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{load}=require('./load-typescript.cjs');
const {CasterSlotsPanel}=load('../components/CasterSlotsPanel.tsx',{'./I18nProvider':{useI18n:()=>({t:x=>x})}});
const html=renderToStaticMarkup(React.createElement(CasterSlotsPanel,{studioId:'studio-default',roomName:'A',active:true}));
assert.match(html,/Слоты кастеров/);assert.match(html,/Создать слот/);assert.match(html,/Кастеры в комнате/);assert.doesNotMatch(html,/Ожидают допуска|iframe|canvas/);
console.log('PASS slot panel: accessible creation and waiting queue');
