type PostFlowCandidate = {
  archived: boolean;
  trigger_type: string;
};

export function isPostAttachableFlow(flow: PostFlowCandidate): boolean {
  return flow.trigger_type === 'comment' && !flow.archived;
}
