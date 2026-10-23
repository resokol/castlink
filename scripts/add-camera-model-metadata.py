# Reproduce: extract schema_py_generated.py and metadata_schema_py_generated.py from
# tflite_support-0.4.4-cp311-cp311-manylinux2014_x86_64.whl beside this script;
# install flatbuffers==25.12.19. No native TFLite Support runtime is required.
# python scripts/add-camera-model-metadata.py ORIGINAL.tflite selfie_segmenter.tflite
from pathlib import Path
import sys
import flatbuffers
import schema_py_generated as schema
import metadata_schema_py_generated as meta
source=Path(sys.argv[1]).read_bytes()
model=schema.ModelT.InitFromObj(schema.Model.GetRootAsModel(source,0))
norm=meta.NormalizationOptionsT();norm.mean=[0.0];norm.std=[255.0]
unit=meta.ProcessUnitT();unit.optionsType=meta.ProcessUnitOptions.NormalizationOptions;unit.options=norm
image=meta.ImagePropertiesT();image.colorSpace=meta.ColorSpaceType.RGB
content=meta.ContentT();content.contentPropertiesType=meta.ContentProperties.ImageProperties;content.contentProperties=image
inp=meta.TensorMetadataT();inp.name='image';inp.content=content;inp.processUnits=[unit]
out=meta.TensorMetadataT();out.name='segmentation_masks'
sub=meta.SubGraphMetadataT();sub.inputTensorMetadata=[inp];sub.outputTensorMetadata=[out]
metadata=meta.ModelMetadataT();metadata.name='MediaPipe Selfie Segmentation';metadata.description='Official general 256x256 selfie model with RGB input normalization x/255 for Tasks Vision.';metadata.subgraphMetadata=[sub]
b=flatbuffers.Builder(0);b.Finish(metadata.Pack(b),b'M001')
buffer=schema.BufferT();buffer.data=bytes(b.Output());model.buffers.append(buffer)
entry=schema.MetadataT();entry.name='TFLITE_METADATA';entry.buffer=len(model.buffers)-1
model.metadata=list(model.metadata or [])+[entry]
b=flatbuffers.Builder(0);b.Finish(model.Pack(b),b'TFL3')
result=bytes(b.Output())
# Prove every original buffer, tensor, operator and graph is preserved.
def plain(value):
    if hasattr(value, 'tolist'): return value.tolist()
    if isinstance(value, (list, tuple)): return [plain(x) for x in value]
    if hasattr(value, '__dict__'): return {k:plain(v) for k,v in vars(value).items()}
    return value
original=schema.ModelT.InitFromObj(schema.Model.GetRootAsModel(source,0))
rebuilt=schema.ModelT.InitFromObj(schema.Model.GetRootAsModel(result,0))
assert plain(original.subgraphs)==plain(rebuilt.subgraphs)
assert plain(original.operatorCodes)==plain(rebuilt.operatorCodes)
assert plain(original.buffers)==plain(rebuilt.buffers[:-1])
Path(sys.argv[2]).write_bytes(result)
