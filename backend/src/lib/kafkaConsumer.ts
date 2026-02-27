/**
 * Kafka Consumer - optional integration, disabled by default.
 * Set KAFKA_ENABLED=true in .env and configure KAFKA_BROKERS to enable.
 */

class KafkaConsumer {
  private connected = false;

  isConnected(): boolean {
    return this.connected;
  }

  async connect(): Promise<void> {
    if (process.env.KAFKA_ENABLED !== 'true') {
      return;
    }
    try {
      const { Kafka } = await import('kafkajs');
      const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
      const kafka = new Kafka({ clientId: 'observai-backend', brokers });
      const consumer = kafka.consumer({ groupId: 'observai-group' });
      await consumer.connect();
      this.connected = true;
      console.log('✅ Kafka consumer connected');
    } catch (error) {
      console.warn('⚠️  Kafka consumer failed to connect:', (error as Error).message);
      this.connected = false;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }
}

const kafkaConsumerInstance = new KafkaConsumer();

export function getKafkaConsumer(): KafkaConsumer {
  return kafkaConsumerInstance;
}
