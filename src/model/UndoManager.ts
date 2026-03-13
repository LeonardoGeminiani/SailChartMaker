/**
 * Generic snapshot-based undo/redo manager.
 * State is serialised with JSON.stringify so T must be JSON-safe.
 */
export class UndoManager<T> {
  private readonly undoStack: string[] = [];
  private readonly redoStack: string[] = [];

  constructor(private readonly maxSteps = 60) {}

  /** Push a snapshot of the current state before a mutation. */
  snapshot(state: T): void {
    this.undoStack.push(JSON.stringify(state));
    if (this.undoStack.length > this.maxSteps) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  /** Restore the previous state. Returns it, or null if the stack is empty. */
  undo(current: T): T | null {
    if (!this.undoStack.length) return null;
    this.redoStack.push(JSON.stringify(current));
    return JSON.parse(this.undoStack.pop()!);
  }

  /** Re-apply an undone state. Returns it, or null if nothing to redo. */
  redo(current: T): T | null {
    if (!this.redoStack.length) return null;
    this.undoStack.push(JSON.stringify(current));
    return JSON.parse(this.redoStack.pop()!);
  }

  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }
}
