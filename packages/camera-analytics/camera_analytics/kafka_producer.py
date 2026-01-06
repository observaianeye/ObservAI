"""
Kafka Producer for ObservAI Camera Analytics
Publishes analytics events to Kafka topics for scalable message processing
"""

import json
import logging
from typing import Dict, Any, Optional

# Kafka is optional - gracefully handle if not installed
try:
    from confluent_kafka import Producer
    from confluent_kafka.admin import AdminClient, NewTopic
    KAFKA_AVAILABLE = True
except ImportError:
    Producer = None
    AdminClient = None
    NewTopic = None
    KAFKA_AVAILABLE = False

logger = logging.getLogger(__name__)


class AnalyticsKafkaProducer:
    """
    Kafka producer for publishing analytics events

    Topics:
    - observai.analytics: Real-time analytics metrics
    - observai.detections: Person detection events
    - observai.insights: Zone insights and behavioral patterns
    """

    def __init__(
        self,
        bootstrap_servers: str = 'localhost:9092',
        enabled: bool = False
    ):
        """
        Initialize Kafka producer

        Args:
            bootstrap_servers: Comma-separated list of Kafka broker addresses
            enabled: Whether Kafka publishing is enabled
        """
        self.enabled = enabled and KAFKA_AVAILABLE
        self.bootstrap_servers = bootstrap_servers
        self.producer: Optional[Producer] = None

        if not KAFKA_AVAILABLE and enabled:
            logger.warning("⚠️ Kafka library not installed (pip install confluent-kafka)")
            logger.warning("   Analytics will continue without Kafka")
            self.enabled = False

        if self.enabled:
            try:
                self._init_producer()
                self._create_topics()
                logger.info(f"✅ Kafka producer initialized: {bootstrap_servers}")
            except Exception as e:
                logger.warning(f"⚠️ Kafka producer initialization failed: {e}")
                logger.warning("   Analytics will continue without Kafka")
                self.enabled = False

    def _init_producer(self):
        """Initialize Confluent Kafka producer"""
        config = {
            'bootstrap.servers': self.bootstrap_servers,
            'client.id': 'observai-camera-analytics',
            'acks': 'all',  # Wait for all replicas
            'retries': 3,
            'linger.ms': 100,  # Batch messages for 100ms
            'compression.type': 'snappy',  # Compress messages
            'max.in.flight.requests.per.connection': 5,
        }
        self.producer = Producer(config)

    def _create_topics(self):
        """Create Kafka topics if they don't exist"""
        admin_client = AdminClient({'bootstrap.servers': self.bootstrap_servers})

        topics = [
            NewTopic('observai.analytics', num_partitions=3, replication_factor=1),
            NewTopic('observai.detections', num_partitions=5, replication_factor=1),
            NewTopic('observai.insights', num_partitions=2, replication_factor=1),
        ]

        try:
            # Check existing topics
            existing_topics = admin_client.list_topics(timeout=5).topics
            new_topics = [t for t in topics if t.topic not in existing_topics]

            if new_topics:
                fs = admin_client.create_topics(new_topics)
                for topic, f in fs.items():
                    try:
                        f.result()
                        logger.info(f"Created topic: {topic}")
                    except Exception as e:
                        logger.debug(f"Topic {topic} may already exist: {e}")
        except Exception as e:
            logger.warning(f"Topic creation check failed: {e}")

    def _delivery_callback(self, err, msg):
        """Callback for message delivery confirmation"""
        if err:
            logger.error(f'Kafka message delivery failed: {err}')
        else:
            logger.debug(f'Message delivered to {msg.topic()} [{msg.partition()}]')

    def publish_analytics(self, metrics: Dict[str, Any], camera_id: str = 'default'):
        """
        Publish analytics metrics to Kafka

        Args:
            metrics: Analytics metrics dictionary
            camera_id: Camera identifier
        """
        if not self.enabled or not self.producer:
            return

        try:
            message = {
                'camera_id': camera_id,
                'timestamp': metrics.get('timestamp'),
                'people_in': metrics.get('people_in', 0),
                'people_out': metrics.get('people_out', 0),
                'current_count': metrics.get('current_count', 0),
                'demographics': metrics.get('demographics', {}),
                'queue_count': metrics.get('queue_count', 0),
                'avg_wait_time': metrics.get('avg_wait_time', 0.0),
                'fps': metrics.get('fps', 0.0),
            }

            self.producer.produce(
                topic='observai.analytics',
                key=camera_id.encode('utf-8'),
                value=json.dumps(message).encode('utf-8'),
                callback=self._delivery_callback
            )

            # Trigger delivery reports
            self.producer.poll(0)

        except Exception as e:
            logger.error(f'Failed to publish analytics: {e}')

    def publish_detection(self, detection: Dict[str, Any], camera_id: str = 'default'):
        """
        Publish person detection event to Kafka

        Args:
            detection: Detection event dictionary
            camera_id: Camera identifier
        """
        if not self.enabled or not self.producer:
            return

        try:
            message = {
                'camera_id': camera_id,
                'timestamp': detection.get('timestamp'),
                'person_id': detection.get('person_id'),
                'bbox': detection.get('bbox', []),
                'confidence': detection.get('confidence', 0.0),
                'age': detection.get('age'),
                'gender': detection.get('gender'),
                'zone': detection.get('zone'),
            }

            self.producer.produce(
                topic='observai.detections',
                key=camera_id.encode('utf-8'),
                value=json.dumps(message).encode('utf-8'),
                callback=self._delivery_callback
            )

            self.producer.poll(0)

        except Exception as e:
            logger.error(f'Failed to publish detection: {e}')

    def publish_insight(self, insight: Dict[str, Any], camera_id: str = 'default'):
        """
        Publish zone insight to Kafka

        Args:
            insight: Insight dictionary
            camera_id: Camera identifier
        """
        if not self.enabled or not self.producer:
            return

        try:
            message = {
                'camera_id': camera_id,
                'timestamp': insight.get('timestamp'),
                'zone_id': insight.get('zone_id'),
                'person_id': insight.get('person_id'),
                'duration': insight.get('duration', 0.0),
                'message': insight.get('message', ''),
                'gender': insight.get('gender'),
                'age': insight.get('age'),
            }

            self.producer.produce(
                topic='observai.insights',
                key=camera_id.encode('utf-8'),
                value=json.dumps(message).encode('utf-8'),
                callback=self._delivery_callback
            )

            self.producer.poll(0)

        except Exception as e:
            logger.error(f'Failed to publish insight: {e}')

    def flush(self, timeout: float = 10.0):
        """
        Flush pending messages

        Args:
            timeout: Maximum time to wait for flush (seconds)
        """
        if self.enabled and self.producer:
            remaining = self.producer.flush(timeout)
            if remaining > 0:
                logger.warning(f'{remaining} messages were not delivered')

    def close(self):
        """Close the producer and flush pending messages"""
        if self.enabled and self.producer:
            logger.info('Closing Kafka producer...')
            self.flush()
            self.producer = None


# Singleton instance
_kafka_producer: Optional[AnalyticsKafkaProducer] = None


def get_kafka_producer(
    bootstrap_servers: str = 'localhost:9092',
    enabled: bool = False
) -> AnalyticsKafkaProducer:
    """
    Get or create Kafka producer singleton

    Args:
        bootstrap_servers: Kafka broker addresses
        enabled: Whether to enable Kafka

    Returns:
        AnalyticsKafkaProducer instance
    """
    global _kafka_producer

    if _kafka_producer is None:
        _kafka_producer = AnalyticsKafkaProducer(
            bootstrap_servers=bootstrap_servers,
            enabled=enabled
        )

    return _kafka_producer
