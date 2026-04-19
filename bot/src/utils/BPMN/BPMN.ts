import fs from 'fs';
import xpath from 'xpath';
import { DOMParser } from '@xmldom/xmldom';

export function readBPMN(filePathFromRoot: string): any {
  const fullFilePath = (process.env.MS_API_ROOT || "/var/www/html/api") + filePathFromRoot;
  const xml = fs.readFileSync(fullFilePath, 'utf-8');

  return new DOMParser().parseFromString(xml, "text/xml");
}

export function getStartBlocks(doc: any): BPMNBlock[] {
  let select = getXPSelect()
  const startBlocks: BPMNBlock[] = [];
  const nodes = select("/bpmn:definitions/bpmn:process/*[self::bpmn:intermediateCatchEvent or self::bpmn:startEvent or self::bpmn:intermediateThrowEvent]", doc) as any;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const blockId = getAttr(node, "id") ?? '-';
    const blockName = getAttr(node, "name") ?? '-';
    const type = node.localName; // e.g. startEvent, intermediateCatchEvent, etc.
    startBlocks.push({
      blockId,
      blockName,
      type
    });
  }
  return startBlocks;
}

export function getNext(doc: any, taskId: string): BPMNBlockFlow[] {
  const list: BPMNBlockFlow[] = [];
  const outgoing = getOutgoingFlows(doc, taskId);
  for (let i = 0; i < outgoing.length; i++) {
    const it = outgoing[i];
    it.properties = getTaskPropertiesById(doc, it.blockId);
    let annotationProps: Record<string, any> = {};

    // we parse annotations as JSON and put into properties
    let errors: string[] = [];
    let blockAnnotations = getOutgoingFlows(doc, it.blockId, "association").map(b => b.blockText ?? null);
    blockAnnotations.forEach((an: string|null) => {
      try {
        let clean = (an ?? '{}').replace(/[\u0000-\u001F\u007F\u00A0\u200B\uFEFF]/g, '');
        let anjson = JSON.parse(clean);
        Object.assign(annotationProps, anjson);
      } catch (e: any) {
        errors.push(`${e.message} ${an}`);
        console.error("Failed to parse block annotation:", an, e);
      }
    });
    if (errors.length > 0) {
      annotationProps.errors = errors;
    }
    it.properties = { ...annotationProps, ...it.properties };
    list.push(it);
  }
  return list;
}

export function getCurrent(doc: any, taskId: string): BPMNBlockFlow | null {
  const blockEl = getTaskById(doc, taskId);
  if (!blockEl) return null;

  let node: BPMNBlockFlow = {
    type: blockEl.localName ?? "",
    blockId: taskId,
    blockName: getAttr(blockEl, "name") ?? "",
    flowId: "",
    flowName: "",
    properties: {}
  };

  const props = getTaskPropertiesById(doc, taskId);
  node.properties = { ...props };

  let annotationProps: Record<string, any> = {};
  let errors: string[] = [];

  const annotations = getOutgoingFlows(doc, taskId, "association");

  annotations.forEach(a => {
    try {
      const raw = a.blockText ?? "{}";
      const clean = raw.replace(/[\u0000-\u001F\u007F\u00A0\u200B\uFEFF]/g, "");
      const parsed = JSON.parse(clean);
      Object.assign(annotationProps, parsed);
    } catch (e: any) {
      errors.push(`${e.message} ${a.blockText}`);
      console.error("Failed to parse block annotation:", a.blockText, e);
    }
  });

  if (errors.length > 0) {
    annotationProps.errors = errors;
  }

  node.properties = { ...annotationProps, ...node.properties };

  return node;
}

function getXPSelect() {
  return xpath.useNamespaces({
    bpmn: "http://www.omg.org/spec/BPMN/20100524/MODEL",
    bpmndi: "http://www.omg.org/spec/BPMN/20100524/DI",
    dc: "http://www.omg.org/spec/DD/20100524/DC",
    di: "http://www.omg.org/spec/DD/20100524/DI",
    modeler: "http://camunda.org/schema/modeler/1.0",
    camunda: "http://camunda.org/schema/1.0/bpmn",
  })
}

function getTaskById(doc: any, taskId: string) {
  let select = getXPSelect();
  let nodes = select("//bpmn:definitions/bpmn:process/*[@id=\"" + taskId + "\"]", doc) as any;
  return nodes[0] || null;
}

function getOutgoingFlows(doc: any, taskId: string, type: string = "sequenceFlow"): Array<BPMNBlockFlow> {
  const select = getXPSelect();
  const outgoing = select("//bpmn:*[@sourceRef=\"" + taskId + "\"]", doc) as any;

  return Array.from(outgoing).map((flowLine: any) => {
    // collect flow props
    const flowId = getAttr(flowLine, "id");

    // we need only "sequenceFlow" (regular arrows)
    // sometimes it is "association" (text annotation block)
    if (flowLine.localName != type) return null;

    let node : BPMNBlockFlow = {
      type: '',
      blockId: getAttr(flowLine, "targetRef") ?? '',
      blockName: '',
      flowId: flowId ?? '',
      flowName: getAttr(flowLine, "name") ?? '',
    }

    // get 
    const targetBlock = getTaskById(doc, node.blockId);
    node.blockName = getAttr(targetBlock, "name") ?? '';
    
    // take text from association only
    if (type == "association") {
      node.blockText = targetBlock.textContent?.trim() ?? '';
    }
    node.type = targetBlock.localName ?? '';
    
    return node;
  }).filter(x => x != null);
}

function getTaskPropertiesById(doc: any, taskId: string): Record<string,string> {
  let select = getXPSelect();
  let props: Record<string, string> = {};
  const taskProps = select(`/bpmn:definitions/bpmn:process/*[@id="${taskId}"]/bpmn:extensionElements/camunda:properties/camunda:property`, doc) as any;
  for (let i = 0; i < taskProps.length; i++) {
    const prop = taskProps[i];
    const name = getAttr(prop, "name");
    const value = getAttr(prop, "value");
    if (name != null && name != "") {
      props[name] = value ?? '';
    }
  }
  return props;
}

function getAttr(node: any, attrName: string): string | null {
  if (node && node.attributes) {
    const attr = node.attributes.getNamedItem(attrName);
    return attr ? attr.value : null;
  }
  return null;
}

export function getEndBlock() {
  return {
    blockId: "mirageEndId",
    blockName: "",
    type: BLOCK_TYPE_END
  }
}

export interface BPMNBlock {
  blockId: string
  blockName: string
  blockText?: string
  name?: string
  type: string
  properties?: Record<string, any>
}

export const BLOCK_TYPE_TASK: string = "task"
export const BLOCK_TYPE_END: string = "endEvent"

// this is a type usually returned by getNext() function
// we need to save the flow name, so we can route it later
export interface BPMNBlockFlow extends BPMNBlock {
  flowId: string // e.g. "Flow_0d267fp"
  flowName: string // e.g. "create_wo" - arrow name
}