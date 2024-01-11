/* Modifications copyright 2020 David Koop

   Original code from https://github.com/jupyterlab/jupyterlab/blob/67de374d1522c60f0113d9b1f692661dd3166fb7/packages/application/src/mimerenderers.ts#L90-L164
   Copyright Project Jupyter Contributors
   licensed under the "BSD 3-Clause License" below

   Copyright (c) 2015 Project Jupyter Contributors
   All rights reserved.

   Redistribution and use in source and binary forms, with or without
   modification, are permitted provided that the following conditions are met:

   1. Redistributions of source code must retain the above copyright notice, this
      list of conditions and the following disclaimer.

   2. Redistributions in binary form must reproduce the above copyright notice,
      this list of conditions and the following disclaimer in the documentation
      and/or other materials provided with the distribution.

   3. Neither the name of the copyright holder nor the names of its
      contributors may be used to endorse or promote products derived from
      this software without specific prior written permission.

   THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
   AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
   IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
   DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
   FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
   DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
   SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
   CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
   OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
   OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { IRenderMime } from '@jupyterlab/rendermime-interfaces';
import { IMimeDocumentTracker, JupyterFrontEnd } from '@jupyterlab/application';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { WidgetTracker } from '@jupyterlab/apputils';
import { DocumentRegistry, MimeDocument, MimeDocumentFactory } from '@jupyterlab/docregistry';
import { LabIcon } from '@jupyterlab/ui-components';
import { OutputWidget } from './index';

/**
 * A mime renderer factory for IPython object data.
 */
function createRendererFactory(
  registry: IRenderMimeRegistry,
  mimeType: string | undefined
): IRenderMime.IRendererFactory {
  return {
    safe: true,
    mimeTypes: mimeType ? [mimeType] : ['text/plain'],
    createRenderer: (options: IRenderMime.IRendererOptions) =>
      new OutputWidget(registry, options)
  };
}

/* code from @jupyterlab/application/mimerenderers.ts
   https://github.com/jupyterlab/jupyterlab/blob/67de374d1522c60f0113d9b1f692661dd3166fb7/packages/application/src/mimerenderers.ts#L90-L164
   with slight modifications to pass rendermime to factory
 */
export function createRendermimePlugin(item: IRenderMime.IExtension) {
  return {
    id: item.id,
    requires: [IMimeDocumentTracker, IRenderMimeRegistry],
    autoStart: true,
    activate: (
      app: JupyterFrontEnd,
      tracker: WidgetTracker<MimeDocument>,
      rendermime: IRenderMimeRegistry
    ) => {
      // Add the mime renderer.
      const rendererFactory = createRendererFactory(
        rendermime,
        item.fileTypes?.[0].mimeTypes?.[0]
      );
      if (item.rank !== undefined) {
        rendermime.addFactory(rendererFactory, item.rank);
      } else {
        rendermime.addFactory(rendererFactory);
      }

      // Handle the widget factory.
      if (!item.documentWidgetFactoryOptions) {
        return;
      }

      const registry = app.docRegistry;
      let options: IRenderMime.IDocumentWidgetFactoryOptions[] = [];
      if (Array.isArray(item.documentWidgetFactoryOptions)) {
        options = item.documentWidgetFactoryOptions;
      } else {
        options = [
          item.documentWidgetFactoryOptions as IRenderMime.IDocumentWidgetFactoryOptions
        ];
      }

      if (item.fileTypes) {
        item.fileTypes.forEach(ft => {
          if (ft.icon) {
            // upconvert the contents of the icon field to a proper LabIcon
            ft = { ...ft, icon: LabIcon.resolve({ icon: ft.icon }) };
          }

          app.docRegistry.addFileType(ft as DocumentRegistry.IFileType);
        });
      }

      options.forEach(option => {
        const toolbarFactory = option.toolbarFactory
          ? (w: MimeDocument) => option.toolbarFactory!(w.content.renderer)
          : undefined;
        const factory = new MimeDocumentFactory({
          renderTimeout: item.renderTimeout,
          dataType: item.dataType,
          rendermime,
          modelName: option.modelName,
          name: option.name,
          primaryFileType: registry.getFileType(option.primaryFileType),
          fileTypes: option.fileTypes,
          defaultFor: option.defaultFor,
          defaultRendered: option.defaultRendered,
          toolbarFactory
        });
        registry.addWidgetFactory(factory);

        factory.widgetCreated.connect((sender, widget) => {
          // Notify the widget tracker if restore data needs to update.
          widget.context.pathChanged.connect(() => {
            void tracker.save(widget);
          });
          void tracker.add(widget);
        });
      });
    }
  };
}
