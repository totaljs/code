mkdir -p .bundle/

cd .bundle
cp -a ../controllers/ controllers
cp -a ../definitions/ definitions
cp -a ../databases/ databases
cp -a ../schemas/ schemas
cp -a ../public/ public
cp -a ../resources/ resources
cp -a ../views/ views

totaljs --bundle code.bundle
cp code.bundle ../code.bundle

cd ..
rm -rf .bundle
echo "DONE"