# TEMPORARY SCRIPT FOR CLONING DIRECTORIES
#!/bin/bash

tmp_dir=$(mktemp -d -t ci-XXXXXXXXXX)
echo $tmp_dir

cd $tmp_dir;
git clone $1
echo $2
cp -a */. $2
rm -rf $2/.git

trap "rm -rf $tmp_dir" EXIT