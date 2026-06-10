import type { FlowStep } from './schema';

const TEXT = {
  tr: { confirm: 'Tüm verilerini silmek istediğinden emin misin?', yes: 'Evet, sil', no: 'Vazgeç', done: 'Verilerin silindi. ✅', cancelled: 'İptal edildi.' },
  en: { confirm: 'Are you sure you want to delete all your data?', yes: 'Yes, delete everything', no: 'Cancel', done: 'Your data has been deleted. ✅', cancelled: 'Cancelled.' },
};

export function buildErasureSteps(lang: 'tr' | 'en'): FlowStep[] {
  const t = TEXT[lang];
  return [
    { id: 'confirm', type: 'send_message', text: t.confirm, buttons: [
      { label: t.yes, action: { type: 'next', next_id: 'execute' } },
      { label: t.no, action: { type: 'next', next_id: 'cancelled' } },
    ] },
    { id: 'execute', type: 'send_message', text: t.done, next_id: 'end' },
    { id: 'cancelled', type: 'send_message', text: t.cancelled, next_id: 'end' },
    { id: 'end', type: 'end' },
  ];
}

export function erasureOutcomeText(lang: 'tr' | 'en', outcome: 'execute' | 'cancelled'): string {
  return outcome === 'execute' ? TEXT[lang].done : TEXT[lang].cancelled;
}

export const ERASURE_FLOW_ID = '__erasure__';
