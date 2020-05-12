import 'reflect-metadata';
import _ from 'lodash';

import {
  DOMWidgetModel,
  DOMWidgetView,
  WidgetView
} from '@jupyter-widgets/base';
import ELK from 'elkjs/lib/elk-api';
import {
  Action,
  ActionDispatcher,
  ActionHandlerRegistry,
  HoverFeedbackAction,
  SelectAction,
  SelectionResult,
  SModelRegistry,
  ToolManager,
  TYPES
} from 'sprotty';

import Worker from '!!worker-loader!elkjs/lib/elk-worker.min.js';

import createContainer from './sprotty/di-config';
import { JLModelSource } from './sprotty/diagram-server';
import { NodeExpandTool, NodeSelectTool } from './tools';

import {
  IFeedbackActionDispatcher,
  FeedbackActionDispatcher
} from './tools/feedback/feedback-action-dispatcher';
import { ToolTYPES } from './tools/types';

export class ELKModel extends DOMWidgetModel {
  defaults() {
    (<any>window).model = this;
    const _elk = new ELK({ workerFactory: () => new (Worker as any)() } as any);

    let defaults = {
      ...super.defaults(),
      value: {},
      _mark_layout: {},
      _elk
    };
    this.setup();
    return defaults;
  }

  setup() {
    this.on('change:value', this.value_changed, this);
  }

  async value_changed() {
    let value = this.get('value'),
      _elk = this.get('_elk');
    if (_elk && value != null && Object.keys(value).length) {
      let layout = await _elk.layout(value);
      this.set('_mark_layout', layout);
    }
  }
}

export class ELKView extends DOMWidgetView {
  model: ELKModel;
  source: JLModelSource;
  container: any;
  private div_id: string;
  toolManager: ToolManager;
  registry: ActionHandlerRegistry;
  actionDispatcher: ActionDispatcher;
  feedbackDispatcher: IFeedbackActionDispatcher;
  elementRegistry: SModelRegistry;

  initialize(parameters: WidgetView.InitializeParameters) {
    super.initialize(parameters);
    this.div_id = 'sprotty-' + Math.random();

    // Create Sprotty viewer
    const container = createContainer(this.div_id, this);
    this.container = container;
    this.source = container.get<JLModelSource>(TYPES.ModelSource);
    this.elementRegistry = container.get(TYPES.SModelRegistry);
    this.toolManager = container.get<ToolManager>(TYPES.IToolManager);
    this.registry = container.get<ActionHandlerRegistry>(ActionHandlerRegistry);
    this.actionDispatcher = container.get<ActionDispatcher>(
      TYPES.IActionDispatcher
    );
    this.feedbackDispatcher = container.get<FeedbackActionDispatcher>(
      ToolTYPES.IFeedbackActionDispatcher
    );
    this.model.on('change:_mark_layout', this.diagramLayout, this);
    this.model.on('change:selected', this.updateSelected, this);
    this.model.on('change:hovered', this.updateHover, this);
    this.model.on('change:interaction', this.interaction_mode_changed, this);
    this.model.on('msg:custom', this.handleMessage, this);
    this.touch(); //to sync back the diagram state

    // Register Action Handlers
    this.registry.register(SelectAction.KIND, this);
    this.registry.register(SelectionResult.KIND, this); //sprotty complains if doesn't have a SelectionResult handler
    this.registry.register(HoverFeedbackAction.KIND, this);

    // Register Tools
    this.toolManager.registerDefaultTools(
      container.resolve(NodeSelectTool),
      container.resolve(NodeExpandTool)
    );
    this.toolManager.enableDefaultTools();

    (<any>window).view = this;
  }

  handle(action: Action) {
    switch (action.kind) {
      case SelectAction.KIND:
        this.source.getSelected().then(ids => {
          this.model.set('selected', ids);
          this.touch();
        });
      case SelectionResult.KIND:
        break;
      case HoverFeedbackAction.KIND:
        let hoverFeedback: HoverFeedbackAction = action as HoverFeedbackAction;
        if (hoverFeedback.mouseIsOver) {
          this.model.set('hovered', hoverFeedback.mouseoverElement);
          this.touch();
        }
        break;
      default:
        break;
    }
  }

  /**
   * Dictionary of events and handlers
   */
  events(): { [e: string]: string } {
    return { click: '_handle_click' };
  }

  /**
   * Handles when the button is clicked.
   */
  _handle_click(event) {
    // event.preventDefault();
    this.send({ event: 'click', id: this.model.get('hovered') });
  }

  render() {
    this.$el[0].id = this.div_id;
    this.diagramLayout().then(() => {
      //TODO center diagram in view after ModelViewer is done rendering
      // this.source.center()
    });
  }

  updateSelected() {
    let selected: string[] = this.model.get('selected');
    let old_selected: string[] = this.model.previous('selected');
    let exiting: string[] = _.difference(old_selected, selected);
    let entering: string[] = _.difference(selected, old_selected);
    this.actionDispatcher.dispatch(new SelectAction(entering, exiting));
  }

  updateHover() {
    let hovered: string = this.model.get('hovered');
    let old_hovered: string = this.model.previous('hovered');
    this.actionDispatcher.dispatchAll([
      new HoverFeedbackAction(hovered, true),
      new HoverFeedbackAction(old_hovered, false)
    ]);
  }

  async interaction_mode_changed() {
    // let interaction = this.model.get('interaction');
    // console.log('interaction ', interaction);
  }

  async diagramLayout() {
    let layout = this.model.get('_mark_layout');
    this.touch();
    await this.source.updateLayout(layout);
  }

  handleMessage(content, buffers) {
    // console.log('custom msg', content, buffers);
    switch (content.action) {
      case 'center': {
        let elementIds: string[];
        if (content.hasOwnProperty('model_id')) {
          if (!Array.isArray(content.model_id)) {
            elementIds = [content.model_id];
          } else {
            elementIds = content.model_id;
          }
        } else {
          elementIds = [];
        }
        this.source.center(elementIds);
      }
    }
  }
}
