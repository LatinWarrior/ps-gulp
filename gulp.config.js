module.exports = function() {
    var config = {
        
        // All js that we want to vet.
        alljs: [
            './src/**/*.js',
            './*.js'
        ]
    };

    return config;
};
