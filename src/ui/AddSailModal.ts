import { SailData } from '../model/types.js';
import { SailStore } from '../model/SailStore.js';

// ── AddSailModal ──────────────────────────────────────────────────────────────
export class AddSailModal {
  constructor(
    private readonly store: SailStore,
    private readonly onAdded: (sail: SailData) => void,
  ) {}

  setup(): void {
    document.getElementById('btnAddSail')!.addEventListener('click', () => this.open());
    document.getElementById('modalCancel')!.addEventListener('click', () => this.close());
    document.getElementById('modalAdd')!.addEventListener('click', () => this._submit());
    document.getElementById('addModal')!.addEventListener('click', e => {
      if (e.target === document.getElementById('addModal')) this.close();
    });
    (document.getElementById('newName') as HTMLInputElement)
      .addEventListener('keydown', e => { if (e.key === 'Enter') this._submit(); });
  }

  open(): void {
    (document.getElementById('newName') as HTMLInputElement).value = '';
    document.getElementById('addModal')!.classList.add('open');
    (document.getElementById('newName') as HTMLInputElement).focus();
  }

  close(): void {
    document.getElementById('addModal')!.classList.remove('open');
  }

  private _submit(): void {
    const name  = (document.getElementById('newName')  as HTMLInputElement).value.trim() || 'Sail';
    const color = (document.getElementById('newColor') as HTMLInputElement).value;
    const ox    = parseFloat((document.getElementById('newAngle') as HTMLInputElement).value) || 90;
    const oy    = parseFloat((document.getElementById('newSpeed') as HTMLInputElement).value) || 15;
    const sail  = this.store.add({ name, color, ox, oy, rx: 20, ry: 6 });
    this.close();
    this.onAdded(sail);
  }
}
