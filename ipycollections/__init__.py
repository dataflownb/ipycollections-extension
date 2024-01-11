from ._version import __version__
from .formatter import enable, disable

def _jupyter_labextension_paths():
    return [{
        "src": "labextension",
        "dest": "@dfnotebook/ipycollections-extension"
    }]

def load_ipython_extension(ipython):
    enable(ipython)

def unload_ipython_extension(ipython):
    disable(ipython)