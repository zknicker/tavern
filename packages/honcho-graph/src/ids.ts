function encodeGraphIdPart(value: string) {
    return encodeURIComponent(value);
}

export function createPeerNodeId(workspaceName: string, peerName: string) {
    return `peer:${encodeGraphIdPart(workspaceName)}:${encodeGraphIdPart(peerName)}`;
}

export function createSessionNodeId(workspaceName: string, sessionName: string) {
    return `session:${encodeGraphIdPart(workspaceName)}:${encodeGraphIdPart(sessionName)}`;
}

export function createPairNodeId(
    workspaceName: string,
    observerPeerName: string,
    observedPeerName: string
) {
    return [
        'pair',
        encodeGraphIdPart(workspaceName),
        encodeGraphIdPart(observerPeerName),
        encodeGraphIdPart(observedPeerName),
    ].join(':');
}

export function createParticipationEdgeId(
    workspaceName: string,
    sessionName: string,
    peerName: string
) {
    return [
        'participates_in',
        encodeGraphIdPart(workspaceName),
        encodeGraphIdPart(sessionName),
        encodeGraphIdPart(peerName),
    ].join(':');
}

export function createRepresentationEdgeId(
    workspaceName: string,
    observerPeerName: string,
    observedPeerName: string
) {
    return [
        'represents',
        encodeGraphIdPart(workspaceName),
        encodeGraphIdPart(observerPeerName),
        encodeGraphIdPart(observedPeerName),
    ].join(':');
}

export function createObservesEdgeId(
    workspaceName: string,
    observerPeerName: string,
    observedPeerName: string
) {
    return [
        'observes',
        encodeGraphIdPart(workspaceName),
        encodeGraphIdPart(observerPeerName),
        encodeGraphIdPart(observedPeerName),
    ].join(':');
}

export function createAboutEdgeId(
    workspaceName: string,
    observerPeerName: string,
    observedPeerName: string
) {
    return [
        'about',
        encodeGraphIdPart(workspaceName),
        encodeGraphIdPart(observerPeerName),
        encodeGraphIdPart(observedPeerName),
    ].join(':');
}

export function createAppearsInEdgeId(
    workspaceName: string,
    observerPeerName: string,
    observedPeerName: string,
    sessionName: string
) {
    return [
        'appears_in',
        encodeGraphIdPart(workspaceName),
        encodeGraphIdPart(observerPeerName),
        encodeGraphIdPart(observedPeerName),
        encodeGraphIdPart(sessionName),
    ].join(':');
}
