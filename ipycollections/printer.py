from traitlets import default

# Modifications copyright 2020 David Koop
#
# Original Code from IPython/lib/pretty.py
# copyright IPython Development Team
# licensed under the "BSD 3-Clause License" below
#
# BSD 3-Clause License
#
# - Copyright (c) 2008-Present, IPython Development Team
# - Copyright (c) 2001-2007, Fernando Perez <fernando.perez@colorado.edu>
# - Copyright (c) 2001, Janko Hauser <jhauser@zscout.de>
# - Copyright (c) 2001, Nathaniel Gray <n8gray@caltech.edu>
#
# All rights reserved.
#
# Redistribution and use in source and binary forms, with or without
# modification, are permitted provided that the following conditions are met:
#
# * Redistributions of source code must retain the above copyright notice, this
#   list of conditions and the following disclaimer.
#
# * Redistributions in binary form must reproduce the above copyright notice,
#   this list of conditions and the following disclaimer in the documentation
#   and/or other materials provided with the distribution.
#
# * Neither the name of the copyright holder nor the names of its
#   contributors may be used to endorse or promote products derived from
#   this software without specific prior written permission.
#
# THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
# AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
# IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
# DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
# FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
# DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
# SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
# CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
# OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
# OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

def _safe_getattr(obj, attr, default=None):
    """Safe version of getattr.

    Same as getattr, but will return ``default`` on any Exception,
    rather than raising.
    """
    try:
        return getattr(obj, attr, default)
    except Exception:
        return default


def _get_mro(obj_class):
    """ Get a reasonable method resolution order of a class and its superclasses
    for both old-style and new-style classes.
    """
    if not hasattr(obj_class, '__mro__'):
        # Old-style class. Mix in object to make a fake new-style class.
        try:
            obj_class = type(obj_class.__name__, (obj_class, object), {})
        except TypeError:
            # Old-style extension type that does not descend from object.
            # FIXME: try to construct a more thorough MRO.
            mro = [obj_class]
        else:
            mro = obj_class.__mro__[1:-1]
    else:
        mro = obj_class.__mro__
    return mro


def _repr_ipycol(obj, p, cycle):
    """A repr that just redirects to the normal repr function."""
    if obj is None or type(obj) in [bool, str, float]:
        return obj
    d = {'t': 'repr', 'v': repr(obj)}
    if cycle:
        d['c'] = True
    return d


def _default_ipycol(obj, p, cycle):
    klass = _safe_getattr(obj, '__class__', None) or type(obj)
    if _safe_getattr(klass, '__repr__', None) is not object.__repr__:
        # A user-provided repr
        return _repr_ipycol(obj, p, cycle)

    # FIXME have to improve the class thing...
    d = {'t': 'default-repr', 'v': [p.to_ipycol(klass), id(obj)]}
    if cycle:
        d['c'] = True
    return d

def _type_repr(obj):
    mod = _safe_getattr(obj, '__module__', None)
    try:
        name = obj.__qualname__
        if not isinstance(name, str):
            # This can happen if the type implements __qualname__ as a property
            # or other descriptor in Python 2.
            raise Exception("Try __name__")
    except Exception:
        name = obj.__name__
        if not isinstance(name, str):
            name = '<unknown type>'

    if mod in (None, '__builtin__', 'builtins', 'exceptions'):
        return name
    else:
        return mod + '.' + name

class IPyCollectionsPrinter:
    def __init__(self):
        self.stack = []
        self.singleton_printers = {}
        self.type_printers = _default_type_printers.copy()
        self.deferred_printers = {}

    def _in_deferred_types(self, cls):
        """
        Check if the given class is specified in the deferred type registry.

        Returns the printer from the registry if it exists, and None if the
        class is not in the registry. Successful matches will be moved to the
        regular type registry for future use.
        """
        mod = _safe_getattr(cls, '__module__', None)
        name = _safe_getattr(cls, '__name__', None)
        key = (mod, name)
        printer = None
        if key in self.deferred_printers:
            # Move the printer over to the regular registry.
            printer = self.deferred_printers.pop(key)
            self.type_printers[cls] = printer
        return printer

    def to_ipycol(self, obj):
        """Serialize the given object to ipython json."""
        obj_id = id(obj)
        cycle = obj_id in self.stack
        self.stack.append(obj_id)
        #         self.begin_group()
        try:
            obj_class = _safe_getattr(obj, '__class__', None) or type(obj)
            # First try to find registered singleton printers for the type.
            try:
                printer = self.singleton_printers[obj_id]
            except (TypeError, KeyError):
                pass
            else:
                return printer(obj, self, cycle)
            # Next walk the mro and check for either:
            #   1) a registered printer
            #   2) a _repr_ipycol_ method
            for cls in _get_mro(obj_class):
                if cls in self.type_printers:
                    # printer registered in self.type_printers
                    return self.type_printers[cls](obj, self, cycle)
                else:
                    # deferred printer
                    printer = self._in_deferred_types(cls)
                    if printer is not None:
                        return printer(obj, self, cycle)
                    else:
                        # Finally look for special method names.
                        # Some objects automatically create any requested
                        # attribute. Try to ignore most of them by checking for
                        # callability.
                        if '_repr_ipycol_' in cls.__dict__:
                            meth = cls._repr_ipycol_
                            if callable(meth):
                                return meth(obj, self, cycle)
                        if len(self.stack) >= 2: # don't do this for non-nested objs
                            if '_repr_mimebundle_' in cls.__dict__:
                                meth = cls._repr_mimebundle_
                                if callable(meth):
                                    klass = _safe_getattr(obj, '__class__', None) or type(obj)
                                    bundle = meth(obj)
                                    if bundle is None:
                                        bundle = [{}, {}]
                                    elif not isinstance(bundle, tuple):
                                        bundle = [bundle, {}]
                                    return {'t': 'mimebundle', 'v': [_type_repr(klass)] + list(bundle)}
                            if '_repr_html_' in cls.__dict__:
                                # send back html as a mimebundle to simplify processing
                                meth = cls._repr_html_
                                if callable(meth):
                                    klass = _safe_getattr(obj, '__class__', None) or type(obj)
                                    return {'t': 'mimebundle', 'v': [_type_repr(klass), {'text/html': meth(obj)}, {}]}
                            elif cls is not object \
                                    and callable(cls.__dict__.get('__repr__')):
                                return _repr_ipycol(obj, self, cycle)

            # only translate the stuff that makes a difference
            if len(self.stack) < 2:
                # GOT NONE
                return None
            return _default_ipycol(obj, self, cycle)
        finally:
            #             self.end_group()
            self.stack.pop()


def mapping_ipycol_factory(type_name):
    def inner(obj, p, cycle):
        if cycle:
            return {'t': type_name, 'c': True}
        output_v = []
        for k, v in obj.items():
            output_v.append([p.to_ipycol(k), p.to_ipycol(v)])
        return {'t': type_name, 'v': output_v}

    return inner


def sequence_ipycol_factory(type_name):
    def inner(obj, p, cycle):
        if cycle:
            return {'t': type_name, 'c': True}
        output_v = [p.to_ipycol(v) for v in obj]
        return {'t': type_name, 'v': output_v}

    return inner


# int is special because javascript stores all numbers as floats
# and can resolve up to +/- 2^53 - 1
def int_repr_ipycol(obj, p, cycle):
    if abs(obj) > 2 ** 53 - 1:
        return {'t': 'bigint', 'v': str(obj)}
    else:
        return obj


list_repr_ipycol = sequence_ipycol_factory('list')
tuple_repr_ipycol = sequence_ipycol_factory('tuple')
set_repr_ipycol = sequence_ipycol_factory('set')
dict_repr_ipycol = mapping_ipycol_factory('dict')
# boolean, str, float, None all translate as normal

_default_type_printers = {
    int: int_repr_ipycol,
    list: list_repr_ipycol,
    tuple: tuple_repr_ipycol,
    set: set_repr_ipycol,
    dict: dict_repr_ipycol
}

# FIXME to add complex, functions, exceptions, classes??
