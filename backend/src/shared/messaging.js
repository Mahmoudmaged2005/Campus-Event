import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { config } from './config.js';

export const MESSAGE_TYPES = ['event.approved', 'event.rejected', 'event.cancelled', 'event.rescheduled'];

let snsClient = null;

function sns() {
  if (snsClient === null) {
    const options = { region: config.awsRegion };
    if (config.snsEndpoint) {
      options.endpoint = config.snsEndpoint;
    }
    snsClient = new SNSClient(options);
  }
  return snsClient;
}

export async function publishMessage(type, data) {
  if (!MESSAGE_TYPES.includes(type)) {
    throw new Error('Unknown message type: ' + type);
  }
  if (!config.snsTopicArn) {
    console.log('Message not sent because SNS_TOPIC_ARN is empty: ' + type);
    return false;
  }
  try {
    await sns().send(
      new PublishCommand({
        TopicArn: config.snsTopicArn,
        Message: JSON.stringify({ type: type, data: data }),
        MessageAttributes: { type: { DataType: 'String', StringValue: type } },
      }),
    );
    return true;
  } catch (error) {
    console.error('Could not send message ' + type + ': ' + error.message);
    return false;
  }
}

export function readQueueMessages(queueEvent) {
  const messages = [];
  for (const record of queueEvent.Records) {
    messages.push(JSON.parse(record.body));
  }
  return messages;
}
