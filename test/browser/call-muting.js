'use strict';

import { PeerUser } from '../peer-user.js';
import { expectEvents, updateRemoteVideos, sleep, logEvents } from '../helper.js';
import config from './config.js'

const assert = chai.assert;
let client;
let peerUser1, peerUser2;
let call;
describe('Call Muting', async function() {
    this.timeout(300000);

    before(async function() {
        Circuit.logger.setLevel(Circuit.Enums.LogLevel.Error);
        client = new Circuit.Client(config.config);
        const res = await Promise.all([PeerUser.create(), PeerUser.create(), client.logon(config.credentials)]);
        peerUser1 = res[0];
        peerUser2 = res[1];
        const conversation = await client.createGroupConversation([peerUser1.userId, peerUser2.userId, 'c2e5d330-5ea2-4f85-aba1-2c00dac2991a'], 'SDK Test: Conference Call');
        call = await client.startConference(conversation.convId, {audio: true, video: false});
        await expectEvents(client, [{
            type: 'callStatus',
            predicate: evt => evt.call.state === Circuit.Enums.CallStateName.Initiated
        }, {
            type: 'callStatus',
            predicate: evt => evt.call.state === Circuit.Enums.CallStateName.Waiting
        }]);
        await sleep(5000); // wait to make sure the call is ready to be joined
        await Promise.all([
            peerUser1.exec('joinConference', call.callId, {audio: true, video: false}),
            peerUser2.exec('joinConference', call.callId, {audio: true, video: false}),
            expectEvents(client, [{
                type: 'callStatus',
                predicate: evt => evt.reason === 'callStateChanged' && evt.call.state === Circuit.Enums.CallStateName.Active
            }, {
                type: 'callStatus',
                predicate: evt => evt.reason === 'participantJoined'
            }])
        ]);
        call = await client.findCall(call.callId);
    });

    after(async function() {
        await Promise.all([peerUser1.destroy(), peerUser2.destroy(), client.logout()]);
    });

    afterEach(async function() {
        client.removeAllListeners();
    });

    it('should getLocalAudioVideoStream', async () => {
        const r = await peerUser1.exec('getLocalAudioVideoStream');
        console.log('r', r);
        const res = await client.getLocalAudioVideoStream();
        console.log('res', res);
    });

    it('should mute participant', async () => {
        await peerUser1.exec('muteParticipant', call.callId, peerUser2.userId);
        await sleep(3000);
        const res = await peerUser1.exec('findCall', call.callId);
        console.log('---', res);
        assert(res.participants.find(user => user.userId === peerUser2.userId).muted);
    });

    it('should mute the call', async () => {
        await peerUser1.exec('mute', call.callId);
        await sleep(3000);
        const res = await peerUser1.exec('findCall', call.callId);
        assert(res.locallyMuted);
    });

    it('should unmute the call', async () => {
        await peerUser1.exec('unmute', call.callId);
        await sleep(3000);
        const res = await peerUser1.exec('findCall', call.callId);
        assert(!res.locallyMuted);
    });

    it('should mute the rtc session', async () => {
        await client.muteRtcSession(call.callId);
        await sleep(3000);
        const res = await client.findCall(call.callId);
        console.log(res);
        const user = await client.getLoggedOnUser();
        assert(res.participants.find(u => u.userId === user.userId).muted);
    });
});
