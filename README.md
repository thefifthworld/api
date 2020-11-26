# The Fifth World API

_v1.0_

This API provides a means of interacting with the Fifth World database. The Fifth World website is just one application that uses it.

[Full Documentation](https://api.thefifthworld.com/v1/docs)

## Installation

The Fifth World API requires [MySQL](https://www.mysql.com/) and [Node.js](https://nodejs.org/en/). If you have those you should be able to run the following commands:

```
mkdir thefifthworld
cd thefifthworld
git clone https://github.com/thefifthworld/api.git
cd api
npm install
```

Next, you will need to install the database on MySQL by running `setup.sql`.

You will also need to set up a configuration file for each environment (typically _development_, _test_, and _production_). See `config/example.json` for an example of how to set up this file. You'll likely want to create `config/development.json` and `config/test.json` right away. You'll need a `config/production.json` if you want to take it into a production environment later.

When you've done that, you can run:

```
npm run serve
```

This will start running the API. If you're planning on contributing to the API, you might want to run
                                 
```
npm run dev
```

instead. This also runs the unit tests before running the API. These tests currently take a while to finish, but they're an important check to make sure that new work doesn't break anything else. The API is a complex system, so this is an important thing to do.

## Contributing

We’d love to work with you to improve the Fifth World website. If you’ve never contributed to a Github project before, you might want to take a look at the [Hello World Github Guide](https://guides.github.com/activities/hello-world/), which walks you through a lot of the basics, like what repositories, commits, and branches mean, and how to use them.

To contribute to the API, you’ll need to run it locally to make sure your changes work. See the _Installation_ section above for more on how to do that. Next, you’ll need to check out the `develop` branch and create a new branch from that. Use this format for your branch name: `TYPE/NAME-NUM-DESC` 

| Element | Notes |
| --- | --- |
| `TYPE` | <p>One of the following:</p><ul><li>`bug` if your branch addresses a bug or problem. A bug fix doesn’t add new functionality to the system, it just fixes something broken.</li>`feature` if your branch adds a new feature to the system. Even if you believe the system lacking this feature constitutes a huge oversight, it counts as a new feature, not a bug fix.</li><li>`doc` if your branch adds or fixes documentation around the system.</li><li>`system` if your branch addresses how the system works (e.g., dependency updates or how the design tokens are parsed).</li></ul>
| `NAME` | Your Github username.
| `NUM` | If your branch addresses [a reported issue](https://github.com/thefifthworld/api/issues), put the number for that issue in the branch name.
| `DESC` | A single word or a very short phrase that describes what the branch does or addresses. Write it all in lowercase, with dashes to replace spaces.

_**Example:** I write these instructions in a branch called `doc/jefgodesky-readme`. It deals with documentation, I have the Github username [jefgodesky](https://github.com/jefgodesky), and we don’t have a Github issue for writing these instructions, so I have no number to refer to._

Next comes the hard part: actually making the changes you’d like to see. Run the API locally to make sure that your changes work and don’t cause any unexpected side effects. When you feel confident that you’ve finished it, push your branch and [make a pull request](https://github.com/thefifthworld/api/compare) to merge your branch back into the `develop` branch. Pull requests create a space for you and the people who administer the API project to collaborate on your changes. Sometimes they’ll approve your changes right away and the process will go very quickly. Other times they might have comments, questions, or suggestions for you. We’ll work together to make sure that we make the best API we can.

Once approved, your work gets merged back into the `develop` branch. When we’ve gotten enough changes, we merge the `develop` branch into the `main` branch to create a new release — at which point, your contribution becomes part of the Fifth World API!
