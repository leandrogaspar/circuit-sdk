'use strict';

const assert = require('assert');
const Circuit = require('../../circuit-node');
const config = require('./config.json');
const helper = require('./helper');
Circuit.logger.setLevel(Circuit.Enums.LogLevel.Error);

let client;
let addedLabelsHT = {};
// let conversation;
let LABEL_SUPPORTED;
describe('Labels', () => {
    before(async () => {
        client = new Circuit.Client(config.bot1);
        await client.logon();
        // const topic = `${Date.now()}a`;
        // conversation = await client.createConferenceBridge(topic);
        LABEL_SUPPORTED = client.addLabels && Circuit.supportedEvents.includes('labelsAdded') && client.editLabel && Circuit.supportedEvents.includes('labelEdited') && client.assignLabels && client.unassignLabels && client.removeLabels && Circuit.supportedEvents.includes('labelsRemoved');
    });

    after(async () => {
        await client.logout();
    });

    it('should add two labels', async () => {
        if (!LABEL_SUPPORTED) {
            console.log('API not yet supported');
            assert(true);
            return;
        }
        const labelValue1 = `${Date.now()}a`;
        const labelValue2 = `${Date.now()}b`;
        const res = await Promise.all([
            client.addLabels([labelValue1, labelValue2]), 
            helper.expectEvents(client, [{
                type: 'labelsAdded',
                predicate: evt => evt.labels.every(label => label.value === labelValue1 || label.value === labelValue2)
            }])
        ]);
        const addedLabels = res[0];
        addedLabels.forEach(label => addedLabelsHT[label.labelId] = label);
        const existingLabels = await client.getAllLabels();
        const existingLabelsHT = {};
        existingLabels.forEach(label => existingLabelsHT[label.labelId] = label); 
        Object.keys(addedLabelsHT).forEach(testLabelId => {
            if (!existingLabelsHT[testLabelId] || existingLabelsHT[testLabelId].value !== addedLabelsHT[testLabelId].value) {
                assert(false);
            }
        });
    });

    it('should edit one of the added labels', async () => {
        if (!LABEL_SUPPORTED) {
            console.log('API not yet supported');
            assert(true);
            return;
        }
        const labelIdToEdit = Object.keys(addedLabelsHT)[0];
        const newValue = `${Date.now()}c`;
        const res = await Promise.all([
            client.editLabel({
                labelId: labelIdToEdit,
                value: newValue
            }), 
            helper.expectEvents(client, [{
                type: 'labelEdited',
                predicate: evt => evt.label.labelId === labelIdToEdit && evt.label.value === newValue
            }])
        ]);    
        const editedLabel = res[0];
        if (editedLabel.value !== newValue) {
            assert(false);
        } else {
            addedLabelsHT[labelIdToEdit] = editedLabel;
        }
        const existingLabels = await client.getAllLabels();
        const returnedLabel = existingLabels.find(label => label.labelId === labelIdToEdit);
        assert(returnedLabel.value === addedLabelsHT[labelIdToEdit].value && returnedLabel.labelId === addedLabelsHT[labelIdToEdit].labelId);
    });

    it('should assign labels', async () => {
        if (!LABEL_SUPPORTED) {
            console.log('API not yet supported');
            assert(true);
            return;
        }
        const labelIdsToAssign = Object.keys(addedLabelsHT);
        const results = await Promise.all([
            client.assignLabels(global.conversation.convId, labelIdsToAssign),
            helper.expectEvents(client, [{
                type: 'conversationUserDataChanged',
                predicate: evt => evt.data.convId === global.conversation.convId && evt.data.labels.every(label => labelIdsToAssign.includes(label))
            }])
        ]);
        const res = results[0];
        res.forEach(labelId => {
            if (!labelIdsToAssign.includes(labelId)) {
                assert(false);
            }
        });
        global.conversation = await client.getConversationById(global.conversation.convId);
        labelIdsToAssign.forEach(labelId => {
            if (!global.conversation.userData.labelIds.includes(labelId)) {
                assert(false);
            }
        });
    });

    it('should get the conversations having the specified label', async () => {
        if (!LABEL_SUPPORTED) {
            console.log('API not yet supported');
            assert(true);
            return;
        }
        // Has to wait because backend has to perform search for getConversationsByFilter
        await helper.sleep(3000);
        const labelIds = Object.keys(addedLabelsHT);
        const labelId = labelIds[0];
        const res = await client.getConversationsByFilter({
            filterConnector: {
                conditions: [{
                    filterTarget: Circuit.Constants.FilterTarget.LABEL_ID,
                    expectedValue: [labelId]
                }]
            },
            retrieveAction: Circuit.Enums.RetrieveAction.CONVERSATIONS
        });
        assert(res.find(conv => conv.convId === global.conversation.convId));

    });

    it('should get conversations by the added label using getConversationsByLabel', async () => {
        if (!LABEL_SUPPORTED) {
            console.log('API not yet supported');
            assert(true);
            return;
        }
        const labelIds = Object.keys(addedLabelsHT);
        const labelId = labelIds[0];
        const res = await client.getConversationsByLabel(labelId);
        assert(res.some(conv => conv.convId === global.conversation.convId));
    });

    it('should unassign labels', async () => {
        if (!LABEL_SUPPORTED) {
            console.log('API not yet supported');
            assert(true);
            return;
        }
        const labelIdsToUnassign = Object.keys(addedLabelsHT);
        const results = await Promise.all([
            client.unassignLabels(global.conversation.convId, labelIdsToUnassign),
            helper.expectEvents(client, [{
                type: 'conversationUserDataChanged',
                predicate: evt => evt.data.convId === global.conversation.convId && labelIdsToUnassign.every(labelId => !evt.data.labels || !evt.data.labels.includes(labelId))
            }])
        ]); 
        const res = results[0];         
        labelIdsToUnassign.forEach(labelId => {
            if (res.includes(labelId)) {
                assert(false);
            }
        });
        global.conversation = await client.getConversationById(global.conversation.convId);
        if (global.conversation.userData.labelIds) {
            labelIdsToUnassign.forEach(labelId => {
                if (global.conversation.userData.labelIds.includes(labelId)) {
                    assert(false);
                }
            });
        }
    });

    it('should remove the two added labels', async () => {
        if (!LABEL_SUPPORTED) {
            console.log('API not yet supported');
            assert(true);
            return;
        }
        const labelsIdsToRemove = Object.keys(addedLabelsHT);
        const res = await Promise.all([
            client.removeLabels(labelsIdsToRemove),
            helper.expectEvents(client, [{
                type: 'labelsRemoved',
                predicate: evt => evt.labelIds.every(labelId => labelsIdsToRemove.includes(labelId))
            }])
        ]); 
        const labelsIdsRemoved = res[0];    
        labelsIdsToRemove.forEach(labelId => {
            if (!labelsIdsRemoved.includes(labelId)) {
                assert(false);
            }
        });
        const remainingLabels = await client.getAllLabels();
        remainingLabels.forEach(label => {
            if (labelsIdsToRemove.includes(label.labelId)) {
                assert(false);
            }
        });
    });
});