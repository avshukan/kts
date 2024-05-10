import pytest
from kubernetes import client

from .utils import path

TEST_NAMESPACE = 'vaultwarden'
APP_NAME = 'vaultwarden'


def get_deploy(ns: str, name: str) -> dict:
    k8s_apps_v1 = client.AppsV1Api()
    deploys = k8s_apps_v1.list_namespaced_deployment(ns)

    for d in deploys.items:
        d = d.to_dict()
        if d['metadata']['name'] == name:
            return d

    assert False, f'deploy {ns}.{name} not found'


def get_pods(ns: str, labels: dict):
    v1 = client.CoreV1Api()

    label_selector = []
    for k, v in labels.items():
        # k = urllib.parse.quote_plus(k)
        # v = urllib.parse.quote_plus(v)
        label_selector.append(f'{k}={v}')

    label_selector = ','.join(label_selector)
    pods = v1.list_namespaced_pod(ns, label_selector=label_selector)
    return [item.to_dict() for item in pods.items]


@pytest.fixture
def app_deploy() -> dict:
    return get_deploy(TEST_NAMESPACE, APP_NAME)


@pytest.fixture
def pg_deploy() -> dict:
    return get_deploy(TEST_NAMESPACE, 'pg')


def basic_checks(spec: dict, image: str):
    template = spec['template']
    template_spec = spec['template']['spec']

    assert path(spec, 'replicas') == 1, 'app should have 1 replica'
    assert path(spec, 'selector', 'match_labels'), 'selector.match_labels is not filled'
    assert path(template, 'metadata', 'labels'), 'template.metadata.labels is not filled'
    assert path(spec, 'selector', 'match_labels') == path(template, 'metadata', 'labels'), \
        'deploymeny selector does not match template labels'

    containers = path(template_spec, 'containers', default=[])
    assert len(containers) == 1, 'template.spec should have 1 container'

    app_container = containers[0]
    assert app_container['image'], 'image is not present in the container'
    assert app_container['image'].split(':')[0] == image, 'image should be vaultwarden/server'
    assert app_container['image'].split(':')[1] != 'latest', 'image should not be latest'


def status_checks(status: dict):
    assert status['available_replicas'] == 1, 'should be 1 availbale replica'
    assert status['ready_replicas'] == 1, 'should be 1 ready replica'
    assert status['replicas'] == 1, 'should be 1 replicas'
    assert not status['unavailable_replicas'], 'should be no unavailable_replicas'


def test_homework(app_deploy, pg_deploy):
    # app tests
    app_spec = app_deploy['spec']
    app_status = app_deploy['status']

    basic_checks(app_spec, image='vaultwarden/server')

    app_containers = path(app_spec['template']['spec'], 'containers', default=[])
    app_container = app_containers[0]
    app_env = app_container['env']
    app_ports = app_container['ports']

    assert len(app_ports) == 1, 'should be 1 container port'
    assert app_ports[0]['container_port'] == 80, 'port should be 80'
    assert app_ports[0]['protocol'] == 'TCP', 'port protocol should be TCP'

    pg_spec = pg_deploy['spec']
    pg_status = pg_deploy['status']

    basic_checks(pg_spec, image='postgres')

    pg_containers = path(pg_spec['template']['spec'], 'containers', default=[])
    pg_container = pg_containers[0]
    pg_env = pg_container['env']
    pg_ports = pg_container['ports']

    assert len(pg_ports) == 1, 'should be 1 container port in pg'
    assert pg_ports[0]['container_port'] == 5432, 'pg port should be 5432'
    assert pg_ports[0]['protocol'] == 'TCP', 'pg port protocol should be TCP'

    # checking env
    pg_password = None
    pg_user = 'postgres'
    pg_db = None
    for env_opt in pg_env:
        env_opt_name = env_opt['name']
        env_opt_value = env_opt['value']

        if env_opt_name == 'POSTGRES_PASSWORD':
            pg_password = env_opt_value
        if env_opt_name == 'POSTGRES_USER':
            pg_user = env_opt_value
        if env_opt_name == 'POSTGRES_DB':
            pg_db = env_opt_value

    if not pg_db:
        pg_db = pg_user

    assert pg_password is not None, 'POSTGRES_PASSWORD should be set'

    app_db_url = None
    assert app_env, 'app env must be specified'
    for env_opt in app_env:
        env_opt_name = env_opt['name']
        env_opt_value = env_opt['value']

        if env_opt_name == 'DATABASE_URL':
            app_db_url = env_opt_value

    assert app_db_url is not None, 'DATABASE_URL must be specified in app'

    status_checks(pg_status)
    status_checks(app_status)

    app_pods = get_pods(TEST_NAMESPACE, path(app_spec, 'template', 'metadata', 'labels'))
    assert len(app_pods) == 1, 'must be 1 app pods'
    assert app_pods[0]['status']['phase'] == 'Running', 'pg pod is running'

    pg_pods = get_pods(TEST_NAMESPACE, path(pg_spec, 'template', 'metadata', 'labels'))
    assert len(pg_pods) == 1, 'must be 1 pg pods'
    assert pg_pods[0]['status']['phase'] == 'Running', 'pg pod is running'
    pg_host = pg_pods[0]['status']['pod_ip']

    pg_connect_url = f'postgresql://{pg_user}:{pg_password}@{pg_host}:5432/{pg_db}'
    assert app_db_url == pg_connect_url, 'DATABASE_URL is invalid'
