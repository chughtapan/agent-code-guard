import type { Edge, Implementation } from "./stepdown-model.js";

interface Component {
  readonly members: readonly Implementation[];
  readonly minIndex: number;
  readonly maxIndex: number;
}

/**
 * Filters call edges that place a caller after a callee outside the caller's
 * strongly connected component.
 *
 * @param edges Resolved same-band call edges.
 * @returns Edges that violate component-level declaration order.
 */
export function violatingEdges(edges: readonly Edge[]): readonly Edge[] {
  const componentByMember = componentMembers(stronglyConnectedComponents(edges));
  return edges.filter((edge) => violatesComponentOrder(edge, componentByMember));
}

function componentMembers(
  components: readonly Component[],
): ReadonlyMap<Implementation, Component> {
  return new Map(components.flatMap((component) => component.members.map((member) => [member, component] as const)));
}

function violatesComponentOrder(
  edge: Edge,
  componentByMember: ReadonlyMap<Implementation, Component>,
): boolean {
  const caller = componentByMember.get(edge.caller);
  const callee = componentByMember.get(edge.callee);
  return caller !== undefined && callee !== undefined && caller !== callee &&
    Math.sign(caller.maxIndex - callee.minIndex) === 1;
}

function graphFromEdges(edges: readonly Edge[]): {
  readonly vertices: ReadonlySet<Implementation>;
  readonly adjacency: ReadonlyMap<Implementation, readonly Implementation[]>;
} {
  const vertices = new Set<Implementation>();
  const adjacency = new Map<Implementation, Implementation[]>();
  for (const edge of edges) {
    vertices.add(edge.caller);
    vertices.add(edge.callee);
    const neighbours = adjacency.get(edge.caller) ?? [];
    neighbours.push(edge.callee);
    adjacency.set(edge.caller, neighbours);
  }
  return { vertices, adjacency };
}

class TarjanState {
  private readonly adjacency: ReadonlyMap<Implementation, readonly Implementation[]>;
  private readonly indexes = new Map<Implementation, number>();
  private readonly lowlinks = new Map<Implementation, number>();
  private readonly stack: Implementation[] = [];
  private readonly onStack = new Set<Implementation>();
  readonly components: Component[] = [];
  private nextIndex = 0;

  constructor(adjacency: ReadonlyMap<Implementation, readonly Implementation[]>) {
    this.adjacency = adjacency;
  }

  visitIfUnseen(vertex: Implementation): void {
    if (!this.indexes.has(vertex)) {
      this.visitIteratively(vertex);
    }
  }

  private visitIteratively(start: Implementation): void {
    this.enter(start);
    const frames: TraversalFrame[] = [{ vertex: start, nextNeighbourIndex: 0 }];
    while (frames.length > 0) {
      const frame = currentFrame(frames);
      const neighbour = this.nextNeighbour(frame);
      if (neighbour === undefined) {
        this.completeFrame(frame, frames);
      } else {
        this.visitNeighbour(frame.vertex, neighbour, frames);
      }
    }
  }

  private completeFrame(frame: TraversalFrame, frames: TraversalFrame[]): void {
    frames.pop();
    this.completeComponent(frame.vertex);
    const caller = frames.at(-1)?.vertex;
    if (caller !== undefined) {
      this.reduceLowlinkFrom(caller, this.lowlinks, frame.vertex);
    }
  }

  private nextNeighbour(frame: TraversalFrame): Implementation | undefined {
    const neighbours = this.adjacency.get(frame.vertex) ?? [];
    const neighbour = neighbours[frame.nextNeighbourIndex];
    frame.nextNeighbourIndex += 1;
    return neighbour;
  }

  private enter(vertex: Implementation): void {
    this.indexes.set(vertex, this.nextIndex);
    this.lowlinks.set(vertex, this.nextIndex);
    this.nextIndex += 1;
    this.stack.push(vertex);
    this.onStack.add(vertex);
  }

  private visitNeighbour(
    vertex: Implementation,
    neighbour: Implementation,
    frames: TraversalFrame[],
  ): void {
    if (!this.indexes.has(neighbour)) {
      this.enter(neighbour);
      frames.push({ vertex: neighbour, nextNeighbourIndex: 0 });
      return;
    }
    if (this.onStack.has(neighbour)) {
      this.reduceLowlinkFrom(vertex, this.indexes, neighbour);
    }
  }

  private reduceLowlinkFrom(
    vertex: Implementation,
    candidates: ReadonlyMap<Implementation, number>,
    neighbour: Implementation,
  ): void {
    const candidate = candidates.get(neighbour);
    const lowlink = this.lowlinks.get(vertex);
    if (candidate !== undefined && lowlink !== undefined) {
      this.lowlinks.set(vertex, Math.min(lowlink, candidate));
    }
  }

  private completeComponent(vertex: Implementation): void {
    if (this.lowlinks.get(vertex) === this.indexes.get(vertex)) {
      this.components.push(componentFromStack(this.stack, this.onStack, vertex));
    }
  }
}

interface TraversalFrame {
  readonly vertex: Implementation;
  nextNeighbourIndex: number;
}

function currentFrame(frames: readonly TraversalFrame[]): TraversalFrame {
  return (
    // The caller's nonempty-worklist loop guarantees a current frame.
    frames.at(-1)!
  );
}

function stronglyConnectedComponents(edges: readonly Edge[]): readonly Component[] {
  const graph = graphFromEdges(edges);
  const state = new TarjanState(graph.adjacency);
  for (const vertex of graph.vertices) {
    state.visitIfUnseen(vertex);
  }
  return state.components;
}

function componentFromStack(
  stack: Implementation[],
  onStack: Set<Implementation>,
  root: Implementation,
): Component {
  const members: Implementation[] = [];
  let member: Implementation | undefined;
  do {
    member = stack.pop();
    if (member === undefined) {
      break;
    }
    onStack.delete(member);
    members.push(member);
  } while (member !== root);
  const indexes = members.map((member) => member.index).sort((left, right) => left - right);
  const maxIndex = (
    // Invariant guarantees a completed component contains at least its root member.
    indexes.at(-1)!
  );
  return { members, minIndex: indexes[0], maxIndex };
}
