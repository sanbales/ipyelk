/**
 * Copyright (c) 2020 Dane Freeman.
 * Distributed under the terms of the Modified BSD License.
 */

/*******************************************************************************
 * Copyright (c) 2017 TypeFox GmbH (http://www.typefox.io) and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *******************************************************************************/

import { DOMWidgetView } from '@jupyter-widgets/base';

import { Container, ContainerModule } from 'inversify';
import {
  TYPES,
  defaultModule,
  boundsModule,
  fadeModule,
  moveModule,
  // hoverModule,
  // Tool,
  // MouseTool,
  exportModule,
  SGraphView,
  ConsoleLogger,
  LogLevel,
  configureViewerOptions,
  SvgExporter,
  configureModelElement,
  SGraph,
  SLabel,
  edgeEditModule,
  undoRedoModule,
  updateModule,
  routingModule,
  modelSourceModule,
  labelEditModule,
  // ICommandStack,
  // ToolManager, DefaultToolsEnablingKeyListener, ToolManagerActionHandler,
  // EnableToolsAction,
  // EnableDefaultToolsAction,
  // configureActionHandler,
  HoverFeedbackCommand,
  configureCommand,
  // HoverFeedbackAction
  // LocalModelSource,
  //
  // ModelRenderer,
  RenderingTargetKind,
  IVNodePostprocessor,
  ViewRegistry
} from 'sprotty';

import { JLModelSource } from './diagram-server';
import {
  ElkNodeView,
  ElkPortView,
  ElkEdgeView,
  ElkLabelView,
  DefNodeView,
  DefsNodeView,
  JunctionView,
  DefPathView,
  DefCircleView,
  DefEllipseView,
  DefRectView,
  DefRawSVGView,
} from './views';
import {
  ElkNode,
  ElkPort,
  ElkEdge,
  ElkJunction,
  DefNode,
  DefsNode,
  DefPath,
  DefCircle,
  DefRect,
  DefEllipse,
  DefRawSVG,
  ElkModelRenderer
} from './sprotty-model';
// import { NodeSelectTool } from '../tools/select';
import { toolFeedbackModule } from '../tools/feedback';
import viewportModule from './viewportModule';
// import {SElkConnectorDef} from './json/defs';

class FilteringSvgExporter extends SvgExporter {
  protected isExported(styleSheet: CSSStyleSheet): boolean {
    return (
      styleSheet.href != null &&
      (styleSheet.href.endsWith('diagram.css') ||
        styleSheet.href.endsWith('sprotty.css'))
    );
  }
}

export default (containerId: string, view: DOMWidgetView) => {
  const elkGraphModule = new ContainerModule((bind, unbind, isBound, rebind) => {
    bind(TYPES.ModelSource)
      .to(JLModelSource)
      .inSingletonScope();

    rebind(TYPES.ILogger)
      .to(ConsoleLogger)
      .inSingletonScope();
    rebind(TYPES.LogLevel).toConstantValue(LogLevel.warn);
    rebind(TYPES.SvgExporter)
      .to(FilteringSvgExporter)
      .inSingletonScope();

    const context = { bind, unbind, isBound, rebind };

    // Initialize model element views
    configureModelElement(context, 'graph', SGraph, SGraphView);
    configureModelElement(context, 'node', ElkNode, ElkNodeView);
    configureModelElement(context, 'port', ElkPort, ElkPortView);
    configureModelElement(context, 'edge', ElkEdge, ElkEdgeView);
    configureModelElement(context, 'label', SLabel, ElkLabelView);
    configureModelElement(context, 'junction', ElkJunction, JunctionView);
    configureViewerOptions(context, {
      needsClientLayout: false,
      baseDiv: containerId
    });

    // Hover
    configureCommand(context, HoverFeedbackCommand);

    // Model elements for defs
    configureModelElement(context, 'defs', DefsNode, DefsNodeView);
    configureModelElement(context, 'def', DefNode, DefNodeView);
    configureModelElement(context, 'path', DefPath, DefPathView);
    configureModelElement(context, 'rect', DefRect, DefRectView);
    configureModelElement(context, 'circle', DefCircle, DefCircleView);
    configureModelElement(context, 'ellipse', DefEllipse, DefEllipseView);
    configureModelElement(context, 'rawsvg', DefRawSVG, DefRawSVGView);

    // Expose extracted path and connector offset to the rendering context
    rebind(TYPES.ModelRendererFactory).toFactory<ElkModelRenderer>(ctx => {
      return (targetKind: RenderingTargetKind, processors: IVNodePostprocessor[]) => {
        const viewRegistry = ctx.container.get<ViewRegistry>(TYPES.ViewRegistry);
        const modelSource = ctx.container.get<JLModelSource>(TYPES.ModelSource);
        return new ElkModelRenderer(viewRegistry, targetKind, processors, modelSource);
      };
    });
  });
  const container = new Container();

  container.load(
    defaultModule,
    boundsModule,
    moveModule,
    fadeModule,
    //    hoverModule,
    updateModule,
    undoRedoModule,
    viewportModule,
    routingModule,
    exportModule,
    modelSourceModule,
    edgeEditModule,
    labelEditModule,
    toolFeedbackModule,
    elkGraphModule
  );
  return container;
};
