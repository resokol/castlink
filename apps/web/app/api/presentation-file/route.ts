import { NextRequest, NextResponse } from 'next/server';
import { presentationGuest } from '@/lib/co-presentation-access';
import { convertPresentationFile, PresentationFileError } from '@/lib/presentation-file';
import { defaultStudioId } from '@/lib/studio-scope';
import { maintenanceResponse } from '@/lib/update-maintenance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

export async function POST(request: NextRequest) {
  const maintenance = maintenanceResponse(request.method, request.nextUrl.pathname);
  if (maintenance) return maintenance;
  const studioId = request.nextUrl.searchParams.get('studioId') || defaultStudioId();
  const room = request.nextUrl.searchParams.get('room') || '';
  // Authentication, current admission and exact LiveKit session are checked before touching body bytes.
  if (!await presentationGuest(request, studioId, room)) return NextResponse.json({ error: 'Нет доступа к презентации.' }, { status: 403, headers });
  try {
    const pdf = await convertPresentationFile(request);
    return new NextResponse(pdf.body, { headers: { ...headers, 'Content-Type': 'application/pdf', 'Content-Length': String(pdf.size), 'Content-Disposition': 'inline; filename="presentation.pdf"' } });
  } catch (error) {
    if (error instanceof PresentationFileError) return NextResponse.json({ error: error.message, ...(error.code ? { code: error.code } : {}) }, { status: error.status, headers });
    return NextResponse.json({ error: 'Не удалось преобразовать PPTX. Сохраните презентацию в PDF.' }, { status: 422, headers });
  }
}
