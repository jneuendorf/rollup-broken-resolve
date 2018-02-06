import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'


export default {
    input: 'src/index.js',
    output: {
        file: 'dist/bundle.js',
        format: 'cjs'
    },
    // name: 'MyModule',
    plugins: [
        resolve(),
        commonjs(),
    ]
}
