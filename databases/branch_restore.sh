#!/bin/sh

# rm -r $2* !("/logs/")
find $2 | grep -v "logs" | grep -v ".pid" | xargs -0 rm -rf
tar -xf $1 -C /