#!/bin/sh

rm -r $2* !("debug.log")
tar -xf $1 -C /