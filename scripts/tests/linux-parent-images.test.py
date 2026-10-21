import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('linux_compose', Path(__file__).resolve().parents[1] / 'linux-compose-setup.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
SOURCE = 'a' * 40


def iid(char): return 'sha256:' + char * 64


def labels(source=SOURCE, stage='web-runtime'):
    return {'ru.castlink.image.owner': 'castlink', 'ru.castlink.image.ownership': 'castlink-build-v1',
            'ru.castlink.image.source': source, 'ru.castlink.image.stage': stage}


def image(char, parent='', marked=True, tags=None):
    return {'Id': iid(char), 'Parent': parent, 'Config': {'Labels': labels() if marked else {}},
            'RepoTags': tags or [], 'RepoDigests': []}


class Engine:
    def __init__(self, images, tags=None, containers=None):
        self.images = {v['Id']: v for v in images}; self.tags = tags or {}; self.containers = containers or {}; self.calls = []

    def __call__(self, args, **kwargs):
        self.calls.append(args)
        if args[:2] == ['image', 'inspect']:
            reference = args[2]; identity = self.tags.get(reference, reference)
            if identity not in self.images: raise ValueError('missing image')
            return json.dumps(self.images[identity]) if args[-1] == '{{json .}}' else identity
        if args[:2] == ['image', 'ls']:
            if args == ['image', 'ls', '-aq', '--no-trunc']: return '\n'.join(self.images)
            return self.tags.get(args[-1], '')
        if args == ['ps', '-aq']: return '\n'.join(self.containers)
        if args[:2] == ['ps', '-aq']: return ''
        if args[0] == 'inspect': return self.containers[args[1]]['Image']
        if args[:2] == ['image', 'rm']:
            if '--no-prune' not in args: raise AssertionError('implicit Docker parent deletion must be disabled')
            self.images.pop(args[-1], None); return ''
        raise AssertionError(args)


class ParentOwnership(unittest.TestCase):
    def receipt(self, folder, *characters):
        m.write_private(folder / m.IMAGE_RECEIPT, {'schemaVersion': 1, 'images': [],
            'parents': [{'id': iid(c), 'source': SOURCE, 'stage': 'web-runtime'} for c in characters]})

    def test_registration_requires_labels_and_exact_release_source_not_ancestry(self):
        leaf = image('f', iid('a')); owned = image('a', iid('b')); foreign = image('b', iid('c'), marked=False)
        wrong_source = image('c'); wrong_source['Config']['Labels'] = labels('b' * 40)
        tag = 'castlink-easy-web:' + SOURCE
        inherited_foreign_child = image('d', iid('f'))
        engine = Engine([leaf, owned, foreign, wrong_source, inherited_foreign_child], {tag: iid('f')})
        with tempfile.TemporaryDirectory() as d, patch.object(m, 'docker', side_effect=engine):
            folder = Path(d)
            m.remember_images(folder, {'commit': SOURCE, 'images': {'web': tag}})
            receipt = m.image_receipt(folder)
            self.assertEqual(receipt.get('parents'), [{'id': iid('a'), 'source': SOURCE, 'stage': 'web-runtime'}])

    def test_only_recorded_marked_unused_parent_is_removed_with_no_prune(self):
        unused = image('a'); unused['RootFS'] = {'Layers': [iid('1')]}
        current = image('f'); current['RootFS'] = {'Layers': [iid('2')]}
        tag = 'castlink-easy-web:' + 'b' * 40
        engine = Engine([unused, image('b', marked=False), image('c'), current], {tag: iid('f')})
        with tempfile.TemporaryDirectory() as d, patch.object(m, 'docker', side_effect=engine):
            folder = Path(d); self.receipt(folder, 'a', 'b')
            m.cleanup_images(folder, {'release': {'images': {'web': tag}}})
            self.assertIn(['image', 'rm', '--no-prune', iid('a')], engine.calls)
            self.assertIn(iid('b'), engine.images)
            self.assertIn(iid('c'), engine.images, 'marked but never recorded is not owned')

    def test_current_release_ancestors_are_preserved(self):
        tag = 'castlink-easy-web:' + 'b' * 40
        engine = Engine([image('f', iid('a')), image('a', iid('b')), image('b')], {tag: iid('f')})
        with tempfile.TemporaryDirectory() as d, patch.object(m, 'docker', side_effect=engine):
            folder = Path(d); self.receipt(folder, 'a', 'b')
            m.cleanup_images(folder, {'release': {'images': {'web': tag}}})
            self.assertFalse(any(c[:2] == ['image', 'rm'] for c in engine.calls))

    def test_all_container_images_and_ancestors_are_preserved_even_stopped(self):
        for running in [True, False]:
            engine = Engine([image('f', iid('a')), image('a', iid('b')), image('b')],
                            containers={'container': {'Image': iid('f'), 'Running': running}})
            with tempfile.TemporaryDirectory() as d, patch.object(m, 'docker', side_effect=engine):
                folder = Path(d); self.receipt(folder, 'f', 'a', 'b')
                m.cleanup_images(folder, {'release': {'images': {}}})
                self.assertFalse(any(c[:2] == ['image', 'rm'] for c in engine.calls))

    def test_changed_marker_or_any_user_tag_preserves_recorded_parent(self):
        for data in [image('a', marked=False), image('a', tags=['someone/keep:latest']), image('a')]:
            if data['Config']['Labels'] and not data['RepoTags']: data['Config']['Labels'] = labels(stage='web-builder')
            engine = Engine([data])
            with tempfile.TemporaryDirectory() as d, patch.object(m, 'docker', side_effect=engine):
                folder = Path(d); self.receipt(folder, 'a')
                m.cleanup_images(folder, {'release': {'images': {}}})
                self.assertIn(iid('a'), engine.images)

    def test_unknown_tags_or_digest_metadata_preserves_parent(self):
        for key, value in [('RepoTags', None), ('RepoDigests', None), ('RepoTags', 'invalid'), ('RepoDigests', ['sha256:foreign'])]:
            data = image('a')
            if value is None: data.pop(key)
            else: data[key] = value
            engine = Engine([data])
            with tempfile.TemporaryDirectory() as d, patch.object(m, 'docker', side_effect=engine):
                folder = Path(d); self.receipt(folder, 'a')
                m.cleanup_images(folder, {'release': {'images': {}}})
                self.assertIn(iid('a'), engine.images)

    def test_missing_parent_field_still_protects_layer_prefix_of_current_or_stopped_image(self):
        for use_container in [False, True]:
            parent = image('a'); parent['RootFS'] = {'Layers': [iid('1')]}
            current = image('f'); current['RootFS'] = {'Layers': [iid('1'), iid('2')]}
            tag = 'castlink-easy-web:' + 'b' * 40
            engine = Engine([parent, current], {tag: iid('f')}, {'stopped': {'Image': iid('f')}} if use_container else {})
            with tempfile.TemporaryDirectory() as d, patch.object(m, 'docker', side_effect=engine):
                folder = Path(d); self.receipt(folder, 'a')
                m.cleanup_images(folder, {'release': {'images': {} if use_container else {'web': tag}}})
                self.assertIn(iid('a'), engine.images)

    def test_old_leaf_tag_of_current_or_container_ancestor_is_preserved_without_parent_receipt(self):
        old = 'castlink-easy-web:' + SOURCE
        current = 'castlink-easy-web:' + 'b' * 40
        for mode in ['current', 'stopped', 'layers']:
            ancestor = image('a'); ancestor['RootFS'] = {'Layers': [iid('1')]}
            root = image('f', '' if mode == 'layers' else iid('a')); root['RootFS'] = {'Layers': [iid('1'), iid('2')]}
            engine = Engine([ancestor, root], {old: iid('a'), current: iid('f')},
                            {'stopped': {'Image': iid('f')}} if mode == 'stopped' else {})
            with tempfile.TemporaryDirectory() as d, patch.object(m, 'docker', side_effect=engine):
                folder = Path(d)
                m.write_private(folder / m.IMAGE_RECEIPT, {'schemaVersion': 1, 'images': [{'tag': old, 'id': iid('a')}]})
                m.cleanup_images(folder, {'release': {'images': {} if mode == 'stopped' else {'web': current}}})
                self.assertFalse(any(c[:2] == ['image', 'rm'] for c in engine.calls))

    def test_update_does_not_adopt_unverified_previous_release_tag(self):
        old = {'commit': SOURCE, 'images': {'web': 'castlink-easy-web:' + SOURCE}}
        new = {'commit': 'b' * 40, 'images': {'web': 'castlink-easy-web:' + 'b' * 40}}
        state = {'release': old}
        engine = Engine([image('a', marked=False), image('f')], {old['images']['web']: iid('a'), new['images']['web']: iid('f')})
        with tempfile.TemporaryDirectory() as d, patch.object(m, 'docker', side_effect=engine), \
                patch.object(m, 'load_images'), patch.object(m, 'render'), \
                patch.object(m, 'compose'), patch.object(m, 'complete'), patch.object(m, 'cleanup_installation'):
            folder = Path(d)
            m.apply_update(folder, state, folder, new, 'en')
            self.assertEqual(m.image_receipt(folder)['images'], [{'tag': new['images']['web'], 'id': iid('f')}])

    def test_incomplete_protection_snapshot_causes_no_deletion(self):
        tag = 'castlink-easy-web:' + 'b' * 40
        engine = Engine([image('a')], {tag: iid('f')})
        with tempfile.TemporaryDirectory() as d, patch.object(m, 'docker', side_effect=engine):
            folder = Path(d); self.receipt(folder, 'a')
            with self.assertRaises(ValueError): m.cleanup_images(folder, {'release': {'images': {'web': tag}}})
            self.assertIn(iid('a'), engine.images)


if __name__ == '__main__': unittest.main()
