import React from 'react';
import { createRoot } from 'react-dom/client';
import SlotOutputPage from '../../app/output/slot/[slotId]/page';
import WatchPage from '../../app/watch/page';
import { qa } from './image-correction-pipeline-adapter';

const root = createRoot(document.getElementById('root')!);
root.render(location.pathname === '/watch' ? <WatchPage /> : <SlotOutputPage />);
Object.assign(window, { imageCorrectionQA: qa });
