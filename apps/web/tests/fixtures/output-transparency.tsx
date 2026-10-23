import React from 'react';
import { createRoot } from 'react-dom/client';
import SlotOutputPage from '../../app/output/slot/[slotId]/page';
import { qa } from './output-transparency-adapter';

const root = createRoot(document.getElementById('root')!);
root.render(<SlotOutputPage />);
Object.assign(window, { outputQA: { ...qa, unmount: () => root.unmount() } });
