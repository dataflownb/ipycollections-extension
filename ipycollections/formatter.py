from IPython.core.formatters import BaseFormatter, FormatterABC, \
    catch_format_error
from traitlets import Unicode

from .printer import IPyCollectionsPrinter

class IPyCollectionsFormatter(BaseFormatter):
    """A JSON string formatter.

    To define the callables that compute the JSONable representation of
    your objects, define a :meth:`_repr_json_` method or use the :meth:`for_type`
    or :meth:`for_type_by_name` methods to register functions that handle
    this.

    The return value of this formatter should be a JSONable list or dict.
    JSON scalars (None, number, string) are not allowed, only dict or list containers.
    """
    format_type = Unicode('application/vnd.ipycollections+json')
    _return_type = (dict)

    @catch_format_error
    def __call__(self, obj):
        """Compute the pretty representation of the object."""
        return IPyCollectionsPrinter().to_ipycol(obj)

formatter_instance = None

def enable(ipython):
    global formatter_instance
    FormatterABC.register(IPyCollectionsFormatter)
    formatter_instance = IPyCollectionsFormatter(
        parent=get_ipython().display_formatter)
    ipython.display_formatter.formatters[
        formatter_instance.format_type] = formatter_instance

def disable(ipython):
    del ipython.display_formatter.formatters[formatter_instance.format_type]