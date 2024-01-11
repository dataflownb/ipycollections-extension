import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { IRenderMime } from '@jupyterlab/rendermime-interfaces';

import { JSONObject } from '@lumino/coreutils';

import { Widget } from '@lumino/widgets';

import { hasSelection } from './selection';
import { createRendermimePlugin } from './mimerenderers';

/**
 * The default mime type for the extension.
 */
const MIME_TYPE = 'application/vnd.ipycollections+json';

/**
 * The class name added to the extension.
 */
const CLASS_NAME = 'mimerenderer-ipycollections';

const MAX_EXPANDED_LEN = 20;
const MAX_COLLAPSE_LEN = 20;
const MAX_SHALLOW_LEN = 10;

/**
 * A widget for rendering IPython object.
 */
export class OutputWidget extends Widget implements IRenderMime.IRenderer {
  /**
   * Construct a new output widget.
   */
  constructor(
    rendermime: IRenderMimeRegistry | null,
    options: IRenderMime.IRendererOptions
  ) {
    super();
    this._rendermime = rendermime;
    this._mimeType = options.mimeType;
    this.addClass('CodeMirror');
    this.addClass('cm-s-jupyter');
    this.addClass('CodeMirror-lines');
    this.addClass(CLASS_NAME);
  }

  handleExpansion(
    data: any,
    parentNode: Node,
    shallow: boolean,
    expanded: boolean
  ): Node {
    if (!shallow) {
      const span = parentNode.appendChild(document.createElement('span'));
      span.className = expanded
        ? 'ipycollections-expanded'
        : 'ipycollections-collapsed';
      span.appendChild(
        document.createTextNode(expanded ? '\u25BC ' : '\u25B6 ')
      );
      span.addEventListener('mouseup', event => {
        if (hasSelection(span)) {
          return;
        }
        event.stopPropagation();
        const newSpan = this.processData(data, !expanded, false);
        parentNode.parentNode?.replaceChild(newSpan, parentNode);
      });
    }

    // basically here we want to return the parentNode or a new span that houses the non-selectable part of the expansion
    if (expanded) {
      parentNode = parentNode.appendChild(document.createElement('span'));
    }
    return parentNode;
  }

  processSequenceNode(
    d: Record<string, any>,
    i: number,
    n: Element,
    expanded: boolean
  ) {
    if (expanded) {
      n.appendChild(document.createTextNode(i.toString() + ': '));
      n.appendChild(this.processData(d, false, false));
    } else {
      n.appendChild(this.processData(d, false, true));
    }
  }

  processMappingNode(d: any[], i: number, n: Element, expanded: boolean) {
    n.appendChild(this.processData(d[0], false, true));
    n.appendChild(document.createTextNode(': '));
    n.appendChild(this.processData(d[1], false, !expanded));
  }

  // four states:
  // expanded: each item has its own line and each item can be expanded (expanded)
  // compact: all items on one line and collection can be expanded (!expanded, !shallow)
  // shallow: all items on one line but literal (!expanded, shallow)
  // repr: no items, just repr (!expanded, shallow, len > MAX_SHALLOW_LEN)
  collectionFormatter(
    type: string,
    startDelim: string,
    endDelim: string,
    processNode: Function,
    lenOptions: { [name: string]: { [name: string]: any } } = {}
  ) {
    return (data: any, expanded = false, shallow = true) => {
      const len = data.v ? data.v.length : -1;
      let startDelimInner = startDelim;
      let endDelimInner = endDelim;
      if (len in lenOptions) {
        if ('repr' in lenOptions[len]) {
          const n = document.createElement('span');
          n.textContent = lenOptions[len]['repr'];
          return n;
        } else if ('startDelim' in lenOptions[len]) {
          startDelimInner = lenOptions[len]['startDelim'];
        } else if ('endDelim' in lenOptions[len]) {
          endDelimInner = lenOptions[len]['endDelim'];
        }
      }

      // cycle
      if (data.c) {
        const n = document.createElement('span');
        n.textContent = `${startDelimInner}...${endDelimInner}`;
        return n;
      }

      // shallow and too long
      if (shallow && len > MAX_SHALLOW_LEN) {
        const n = document.createElement('span');
        n.className = 'ipycollections-field';
        n.textContent = `<${data.t} len=${len}>`;
        return n;
      }

      const parentNode = document.createElement('span');
      if (!shallow && len > 0) {
        parentNode.className = expanded
          ? 'ipycollections-expanded'
          : 'ipycollections-collapsed';
        let span = parentNode;
        if (expanded) {
          // create a span for clicks on just first line
          span = parentNode.appendChild(document.createElement('span'));
          span.appendChild(
            document.createTextNode(`\u25BC ${startDelimInner}`)
          );
          const comment = span.appendChild(document.createElement('span'));
          comment.className = 'cm-comment';
          comment.textContent = ` # len=${len}`; // item${len == 1 ? '' : 's'}
        } else {
          // whole thing listens for clicks
          parentNode.appendChild(
            document.createTextNode(`\u25B6 ${startDelimInner}`)
          );
        }

        span.addEventListener('mouseup', event => {
          if (hasSelection(span)) {
            return;
          }
          event.stopPropagation();
          const newParentNode = this.processData(data, !expanded, false);
          parentNode?.parentNode?.replaceChild(newParentNode, parentNode);
        });
      } else {
        parentNode.appendChild(document.createTextNode(startDelimInner));
      }

      // have to figure if we have max_container_len
      let printNum: number;
      if (expanded) {
        printNum = Math.min(len, MAX_EXPANDED_LEN);
      } else {
        printNum = Math.min(len, MAX_COLLAPSE_LEN);
      }
      const it = data.v.entries();
      let next = { value: undefined as unknown as Record<string, any>, done: true };
      const printValue = (itValue: Record<string, any>) => {
        let n: Element;
        if (expanded) {
          n = document.createElement('div');
        } else {
          n = document.createElement('span');
        }
        n.className = 'ipycollections-field';
        // FIXME fun one is how to deal with compound keys (can you expand them?)
        // for now, just make them shallow
        processNode.call(this, itValue.value[1], itValue.value[0], n, expanded);
        n.appendChild(document.createTextNode(', '));
        return n;
      };
      for (let i = 0; !(next = it.next()).done && i < printNum; ++i) {
        parentNode.appendChild(printValue(next));
      }
      if (!next.done) {
        if (expanded) {
          const n = parentNode.appendChild(document.createElement('div'));
          n.className = 'ipycollections-field';
          const button = n.appendChild(document.createElement('button'));
          button.textContent = 'More...';
          button.addEventListener('click', (e: Event) => {
            e.stopPropagation();
            if (parentNode.lastChild?.previousSibling) {
              parentNode.insertBefore(
                printValue(next),
                parentNode.lastChild.previousSibling
              );
              for (let i = 0; !(next = it.next()).done && i < printNum - 1; ++i) {
                parentNode.insertBefore(
                  printValue(next),
                  parentNode.lastChild.previousSibling
                );
              }
              if (next.done) {
                parentNode.removeChild(parentNode.lastChild.previousSibling);
                // remove last comma
                if (parentNode.lastChild.previousSibling?.lastChild) {
                  parentNode.lastChild.previousSibling.removeChild(
                    parentNode.lastChild.previousSibling.lastChild
                  );
                }
              }
            }
          });
        } else {
          parentNode.appendChild(document.createTextNode('...'));
        }
      } else if (len > 0) {
        // remove last comma
        if (parentNode.lastChild && parentNode.lastChild.lastChild) {
          parentNode.lastChild.removeChild(parentNode.lastChild.lastChild);
        }
      }
      parentNode.appendChild(document.createTextNode(endDelimInner));
      return parentNode;
    };
  }

  numberFormatter(data: any, expanded = false, shallow = true) {
    const n = document.createElement('span');
    n.className = 'cm-number';
    n.textContent = data.toString();
    return n;
  }

  bigintFormatter(data: any, expanded = false, shallow = true) {
    const n = document.createElement('span');
    n.className = 'cm-number';
    n.textContent = data.v; // already a string
    return n;
  }

  reprFormatter(data: any, expanded = false, shallow = true) {
    const n = document.createElement('span');
    n.appendChild(document.createTextNode(data.v));
    return n;
  }

  defaultReprFormatter(data: any, expanded = false, shallow = true) {
    const n = document.createElement('span');
    n.appendChild(
      document.createTextNode(`<${data.v[0]} at 0x${data.v[1].toString(16)}>`)
    );
    return n;
  }

  mimeBundleFormatter(data: any, expanded = false, shallow = true) {
    const parentNode = document.createElement('span');
    if (!shallow) {
      parentNode.className = expanded
        ? 'ipycollections-expanded'
        : 'ipycollections-collapsed';
      let span = parentNode;
      if (expanded) {
        // create a span for clicks on just first line
        span = parentNode.appendChild(document.createElement('span'));
        span.appendChild(document.createTextNode('\u25BC '));
      } else {
        // whole thing listens for clicks
        parentNode.appendChild(document.createTextNode('\u25B6 '));
      }

      span.addEventListener('mouseup', event => {
        if (hasSelection(span)) {
          return;
        }
        event.stopPropagation();
        const newParentNode = this.processData(data, !expanded, false);
        parentNode?.parentNode?.replaceChild(newParentNode, parentNode);
      });
    }
    if (!expanded) {
      parentNode.appendChild(document.createTextNode(`<${data.v[0]}>`));
    } else {
      // call the rendermime stuff
      if (this._rendermime !== null) {
        const model = this._rendermime.createModel({
          trusted: true,
          data: data.v[1],
          metadata: data.v[2]
        });

        const mimeType = this._rendermime.preferredMimeType(
          model.data,
          model.trusted ? 'any' : 'ensure'
        );
        if (mimeType) {
          const renderer = this._rendermime.createRenderer(mimeType);
          renderer.renderModel(model).then(() => {
            if (renderer.node !== null) {
              const n = parentNode.appendChild(document.createElement('span'));
              n.appendChild(renderer.node);
            }
          });
        }
      }
    }
    return parentNode;
  }

  stringFormatter(data: any, expanded = false, shallow = true) {
    // have to deal with quotes inside of quotes thing
    const n = document.createElement('span');
    n.className = 'cm-string';
    if (data.includes("'")) {
      if (data.includes('"')) {
        // escape the "
        n.textContent = "'" + data.replace('"', '\\"') + "'";
      } else {
        n.textContent = '"' + data + '"';
      }
    } else {
      n.textContent = "'" + data + "'";
    }
    return n;
  }

  booleanFormatter(data: any, expanded = false, shallow = true) {
    const n = document.createElement('span');
    n.className = 'cm-keyword';
    n.textContent = data ? 'True' : 'False';
    return n;
  }

  nullFormatter(data: any, expanded = false, shallow = true) {
    const n = document.createElement('span');
    n.className = 'cm-keyword';
    n.textContent = 'None';
    return n;
  }

  formatters: { [formatType: string]: Function } = {
    dict: this.collectionFormatter('dict', '{', '}', this.processMappingNode),
    list: this.collectionFormatter('list', '[', ']', this.processSequenceNode),
    tuple: this.collectionFormatter(
      'tuple',
      '(',
      ')',
      this.processSequenceNode,
      { 1: { endDelim: ',)' } }
    ),
    set: this.collectionFormatter('set', '{', '}', this.processSequenceNode, {
      0: { repr: 'set()' }
    }),
    mimebundle: this.mimeBundleFormatter,
    number: this.numberFormatter,
    bigint: this.bigintFormatter,
    repr: this.reprFormatter,
    // eslint-disable-next-line @typescript-eslint/camelcase
    default_repr: this.defaultReprFormatter,
    string: this.stringFormatter,
    boolean: this.booleanFormatter,
    null: this.nullFormatter
  };

  processData(data: any, expanded = false, shallow = false) {
    // algorithm
    // recursively step through data and render/transform each element
    let type: keyof Record<string, any>;
    if (typeof data === 'object' && data !== null) {
      type = data.t;
    } else if (data === null) {
      type = 'null' as keyof Record<string, any>;
    } else {
      type = typeof data as keyof Record<string, any>;
    }

    const formatter: Function = (this.formatters[
      type as keyof Record<string, any>
    ] as Function).bind(this);

    return formatter(data, expanded, shallow);
  }

  /**
   * Render IPython object into this widget's node.
   */
  renderModel(model: IRenderMime.IMimeModel): Promise<void> {
    const data = model.data[this._mimeType] as JSONObject;
    this.node.appendChild(this.processData(data));

    return Promise.resolve();
  }

  private _mimeType: string;
  private _rendermime: IRenderMimeRegistry | null;
}

export const bogusRendererFactory: IRenderMime.IRendererFactory = {
  safe: true,
  mimeTypes: [MIME_TYPE],
  createRenderer: options => {
    return new OutputWidget(null, options);
  }
};

/**
 * Extension definition.
 */
const extensionInfo: IRenderMime.IExtension = {
  id: 'ipycollections-renderer:plugin',
  // FIXME can we create the extension without going through this?
  rendererFactory: bogusRendererFactory,
  rank: 0,
  dataType: 'json',
  fileTypes: [
    {
      name: 'IPython object',
      mimeTypes: [MIME_TYPE],
      extensions: ['.ipycollections']
    }
  ],
  documentWidgetFactoryOptions: {
    name: 'IPython Renderer',
    primaryFileType: 'IPython object',
    fileTypes: ['IPython object'],
    defaultFor: ['IPython object']
  }
};

const extension = createRendermimePlugin(extensionInfo);

export default extension;
