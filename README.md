# ipycollections-extension

![Github Actions Status](https://github.com/dakoop/ipycollections-extension/workflows/Build/badge.svg)

A JupyterLab extension that provides a more interactive format for collections

This extension is composed of a Python package named `ipycollections`
for the IPython extension and a NPM package named `ipycollections-extension`
for the frontend extension.

## Requirements

* JupyterLab >= 2.0

## Install

Note: You will need NodeJS to install the extension. (If using conda, this can be done via `conda install nodejs`.)

```bash
pip install ipycollections
jupyter lab build
```
## Usage

In a JupyterLab notebook, use the following line to enable the extension

```
%load_ext ipycollections
``` 

If you would like the extension to be enabled by default, edit your 
[configuration file](https://ipython.readthedocs.io/en/stable/development/config.html) 
(often `~/.ipython/profile_default/ipython_config.py`) to include `ipycollections` as an extension:

```
c.InteractiveShellApp.extensions = [
    'ipycollections',
    # ...
]
```

If you wish to disable the extension, use:

```
%unload_ext ipycollecitons
```

## Troubleshooting

If you are not seeing the frontend, check the frontend is installed:

```bash
jupyter labextension list
```

If it is installed, try:

```bash
jupyter lab clean
jupyter lab build
```

## Contributing

### Install

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

```bash
# Clone the repo to your local environment
# Move to ipycollections directory

# Install the python package
pip install -e .

# Install dependencies
jlpm
# Build Typescript source
jlpm build
# Link your development version of the extension with JupyterLab
jupyter labextension install .
# Rebuild Typescript source after making changes
jlpm build
# Rebuild JupyterLab after making any changes
jupyter lab build
```

You can watch the source directory and run JupyterLab in watch mode to watch for changes in the extension's source and automatically rebuild the extension and application.

```bash
# Watch the source directory in another terminal tab
jlpm watch
# Run jupyterlab in watch mode in one terminal tab
jupyter lab --watch
```

Now every change will be built locally and bundled into JupyterLab. Be sure to refresh your browser page after saving file changes to reload the extension (note: you'll need to wait for webpack to finish, which can take 10s+ at times).

### Uninstall

```bash
pip uninstall ipycollections
jupyter labextension uninstall ipycollections-extension
```
