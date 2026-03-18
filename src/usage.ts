import { marked } from 'marked';

async function load(): Promise<void> {
  const content = document.getElementById('content')!;
  try {
    const res = await fetch('./USAGE.md');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const md = await res.text();
    content.innerHTML = marked.parse(md) as string;
    buildTOC();
  } catch (err) {
    content.innerHTML = `<p class="state-msg">Could not load USAGE.md — ${(err as Error).message}</p>`;
  }
}

function buildTOC(): void {
  const headings = document.querySelectorAll<HTMLHeadingElement>('#content h2');
  const list     = document.getElementById('tocList')!;
  headings.forEach((h, i) => {
    const id      = 'section-' + i;
    h.id          = id;
    const li      = document.createElement('li');
    const a       = document.createElement('a');
    a.href        = '#' + id;
    a.textContent = h.textContent;
    li.appendChild(a);
    list.appendChild(li);
  });
  if (!list.children.length) {
    (document.getElementById('toc') as HTMLElement).style.display = 'none';
  }
}

load();
