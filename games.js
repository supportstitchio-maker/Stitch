let userPoints = 0;
        let userStreak = 7;
        let quizzesWon = 0;
        let lastDailyQuizDate = null; 
        let quizPointsEarned = 0;
        let quizWasPerfect = false;

        let userCoins = 500;
        let quizStake = 0;
        let quizOpponent = null;
        let quizOpponentScore = 0;
        let quizCoinResult = null; 

        let quizBackgroundImages = [];
        let currentQuizBackground = null;
        let flashcardBackImage = "";
        // ---- Quiz background theme + progress state ----
        function pickRandomQuizBackground(){
          currentQuizBackground = quizBackgroundImages[Math.floor(Math.random() * quizBackgroundImages.length)];
        }
        function applyQuizBackground(){
          const ov = document.getElementById('overlay');
          if (!ov) return;
          if (currentQuizBackground) {
            ov.style.backgroundImage = `url('${currentQuizBackground}')`;
            ov.style.backgroundSize = 'cover';
            ov.style.backgroundPosition = 'center';
            ov.style.backgroundRepeat = 'no-repeat';
          }
        }
        function clearQuizBackground(){
          const ov = document.getElementById('overlay');
          if (!ov) return;
          ov.style.backgroundImage = '';
          ov.style.backgroundSize = '';
          ov.style.backgroundPosition = '';
          ov.style.backgroundRepeat = '';
          currentQuizBackground = null;
        }
        let quizCoinDelta = 0;
        const quizOpponentPool = [
          { id: 'NEX-4471', name: 'Kwame Mensah', color: '#2563eb' },
          { id: 'NEX-8823', name: 'Efua Owusu', color: '#16a34a' },
          { id: 'NEX-1950', name: 'Yaw Darko', color: '#dc2626' },
          { id: 'NEX-6642', name: 'Abena Sarpong', color: '#9333ea' },
          { id: 'NEX-3317', name: 'Kojo Antwi', color: '#ea580c' },
          { id: 'NEX-7205', name: 'Adjoa Mensimah', color: '#0891b2' },
        ];
        const quizStakeOptions = [20, 50, 100, 200, 500, 1000, 1500, 2000];
        let quizFriends = [];

        let leaderboard = [
          { name: 'You', pts: userPoints, me: true },
        ];
        leaderboard.sort((a, b) => b.pts - a.pts);

        function getProgressSnapshot(){
          return {
            userPoints, userCoins, userStreak, quizzesWon, quizWasPerfect,
            lastDailyQuizDate,
          };
        }

        function applyProgressSnapshot(data){
          applyUserState(data);
        }

        async function saveProgress(){
          queueSaveUserState();
        }

        async function loadProgress(){
          await ensureUserStateLoaded();
        }



        // ---- Badges + daily quiz status ----
        function getBadges(){
          const myRank = leaderboard.findIndex(p => p.me);
          return [
            { icon: 'flame', label: '7-day streak', desc: "Complete the Daily Quiz 7 days in a row.", earned: userStreak >= 7 },
            { icon: 'target', label: 'Perfect score', desc: "Answer every question right in a quiz.", earned: quizWasPerfect },
            { icon: 'bolt', label: 'Speed runner', desc: "Pass a timed quiz with a 70%+ score.", earned: quizzesWon > 0 },
            { icon: 'trophy', label: 'Top 10', desc: "Reach the top 10 on the leaderboard.", earned: myRank !== -1 && myRank < 10 },
            { icon: 'crown', label: 'Quiz champion', desc: "Take the #1 spot on the leaderboard.", earned: myRank === 0 },
            { icon: 'gem', label: 'Point collector', desc: "Earn 2,000 points.", earned: userPoints >= 2000 },
          ];
        }

        function todayStr(){ return new Date().toDateString(); }
        function yesterdayStr(){
          const d = new Date();
          d.setDate(d.getDate() - 1);
          return d.toDateString();
        }
        function isDailyQuizDoneToday(){ return lastDailyQuizDate === todayStr(); }

        const dailyQuizBank = [
          { text: "What's the best first step when solving a problem you don't fully understand?", options: ['Guess an answer immediately','Break it into smaller, clearer parts','Ignore it and move on','Wait for someone else to solve it'], correct: 1 },
          { text: "A shop offers '50% off, then an extra 20% off.' What is the total discount?", options: ['70%','60%','56%','50%'], correct: 1 , calc: true },
          { text: 'A train leaves at 2:15pm and arrives at 5:05pm. How long was the journey?', options: ['2h 50m','2h 40m','3h 10m','2h 55m'], correct: 0 , calc: true },
          { text: 'Which planet is closest to the Sun?', options: ['Venus','Mercury','Earth','Mars'], correct: 1 },
          { text: 'What is the boiling point of water at sea level, in Celsius?', options: ['90°','100°','110°','120°'], correct: 1 },
          { text: 'You have 3 apples, give away 1, then buy 4 more. How many do you have now?', options: ['6','7','8','5'], correct: 0 , calc: true },
          { text: 'Which of these is NOT one of the seven continents?', options: ['Antarctica','Greenland','Australia','Europe'], correct: 1 },
          { text: 'If today is Wednesday, what day will it be in 10 days?', options: ['Friday','Saturday','Sunday','Monday'], correct: 1 , calc: true },
          { text: 'Which of these best describes a logical fallacy?', options: ['A true statement backed by strong evidence','A flawed piece of reasoning that weakens an argument','A widely accepted scientific fact','A formal mathematical proof'], correct: 1 },
          { text: 'What is the official currency of Japan?', options: ['Yuan','Won','Yen','Ringgit'], correct: 2 },
          { text: 'A recipe needs 2 cups of flour for 6 servings. How much flour is needed for 9 servings?', options: ['3 cups','2.5 cups','3.5 cups','4 cups'], correct: 0 , calc: true },
          { text: 'Which is the largest ocean on Earth?', options: ['Atlantic','Indian','Arctic','Pacific'], correct: 3 },
          { text: "Given 'All cats are animals,' which conclusion is logically valid?", options: ['All animals are cats','Some animals are cats','No animals are cats','Some cats are not animals'], correct: 1 },
          { text: "'All good employees are punctual. Sarah is punctual.' What can we validly conclude?", options: ['Sarah is a good employee','We cannot conclude Sarah is a good employee from this alone','Sarah is late','Good employees are never punctual'], correct: 1 },
          { text: 'What is the capital of Australia?', options: ['Sydney','Melbourne','Canberra','Perth'], correct: 2 },
          { text: 'What number comes next in the sequence: 2, 4, 8, 16, __?', options: ['24','32','30','20'], correct: 1 , calc: true },
          { text: 'A shirt costs $40 and is on sale for 25% off. What is the sale price?', options: ['$30','$32','$28','$35'], correct: 0 , calc: true },
          { text: 'Ice cream sales and drowning incidents both rise in summer. This is best described as an example of:', options: ['Correlation without proven causation','A direct cause-and-effect relationship','A logical contradiction','An unrelated coincidence with no pattern'], correct: 0 },
          { text: 'What is the freezing point of water in Fahrenheit?', options: ['0°','32°','100°','212°'], correct: 1 },
          { text: "You're planning a trip and notice storm warnings for your route. What's the most reasonable next step?", options: ['Ignore the warnings and leave as planned','Check for updated forecasts and consider delaying or rerouting','Cancel all future travel permanently','Assume the warning is exaggerated'], correct: 1 },
          { text: 'Which gas do plants primarily absorb from the air for photosynthesis?', options: ['Oxygen','Carbon dioxide','Nitrogen','Hydrogen'], correct: 1 },
          { text: 'A rectangle has a length of 8m and a width of 5m. What is its area?', options: ['13 m²','26 m²','40 m²','45 m²'], correct: 2 , calc: true },
          { text: "You get two job offers: one pays more but has a long commute, the other pays less but is flexible and remote. What's the most useful first step?", options: ['Pick whichever sounds more impressive to others','Weigh both against your own priorities around time, money, and lifestyle','Choose whichever company is bigger','Flip a coin'], correct: 1 },
          { text: 'Which of these numbers is a prime number?', options: ['21','27','29','33'], correct: 2 , calc: true },
          { text: 'What is the largest organ in the human body?', options: ['Heart','Liver','Skin','Lungs'], correct: 2 },
          { text: 'A car travels 180 km in 3 hours. What is its average speed?', options: ['45 km/h','60 km/h','50 km/h','70 km/h'], correct: 1 , calc: true },
          { text: 'Which of these is an example of circular reasoning?', options: ["'It's true because I read it in a reliable source'", "'It's true because it says so right here'", "'The experiment was repeated and gave the same result'", "'Most experts agree, based on the evidence'"], correct: 1 },
          { text: 'Who is credited with developing the theory of relativity?', options: ['Isaac Newton','Albert Einstein','Niels Bohr','Galileo Galilei'], correct: 1 },
          { text: "A store's return policy allows returns within 30 days, but you're on day 32. What's the most reasonable action?", options: ['Demand a return anyway and argue', 'Politely ask if there is any flexibility, and accept the answer if not', 'Return it without mentioning the date', 'Give up without even asking'], correct: 1 },
          { text: 'What is 15% of 200?', options: ['15','20','30','35'], correct: 2 , calc: true },
          { text: 'Which continent is the Sahara Desert located on?', options: ['Asia','Africa','Australia','South America'], correct: 1 },
          { text: 'What is the main benefit of checking a claim against multiple independent sources?', options: ['It guarantees the claim is true','It reduces the risk of relying on one biased or mistaken source','It makes the claim sound more exciting','It has no real benefit'], correct: 1 },
          { text: 'How many degrees are in a right angle?', options: ['45°','90°','180°','360°'], correct: 1 },
          { text: 'What is the chemical symbol for gold?', options: ['Ag','Gd','Au','Go'], correct: 2 },
          { text: "You notice you feel unwell a few hours after eating a certain food, more than once. What's the most reasonable next step?", options: ['Assume it is a coincidence and ignore it','Keep track of it over a few more instances before drawing a firm conclusion','Never eat any food again','Tell everyone that food is dangerous'], correct: 1 },
          { text: 'Which is the smallest prime number?', options: ['0','1','2','3'], correct: 2 , calc: true },
          { text: 'Which of these best describes a strawman argument?', options: ["Restating someone's argument fairly before responding", "Misrepresenting someone's argument to make it easier to attack", 'Providing strong evidence for a claim', 'Conceding a valid point in a debate'], correct: 1 },
          { text: 'If you mix equal parts of blue and yellow paint, what color do you get?', options: ['Purple','Orange','Green','Brown'], correct: 2 },
          { text: 'A jacket priced at $80 goes up 10%, then down 10%. What is the final price?', options: ['$80.00','$79.20','$81.00','$78.00'], correct: 1 , calc: true },
          { text: "What does the phrase 'correlation does not imply causation' mean?", options: ['Two things happening together proves one causes the other','Two things can be related without one necessarily causing the other','Correlation is always just coincidence','Causation can never be proven'], correct: 1 },
          { text: 'Which is generally the most reliable way to make a decision under uncertainty?', options: ['Gut feeling alone','Weighing the available evidence and likely outcomes','Copying whatever everyone else is doing','Avoiding the decision entirely'], correct: 1 },
          { text: 'What is the capital of Canada?', options: ['Toronto','Vancouver','Ottawa','Montreal'], correct: 2 },
          { text: 'In a group of 30 people, 18 like tea and 15 like coffee, with 8 liking both. How many like neither?', options: ['5','8','10','3'], correct: 0 , calc: true },
          { text: "'If it rains, the ground gets wet. The ground is wet, therefore it rained.' This reasoning is:", options: ['A valid deduction','A common reasoning error, since other things could have wet the ground','An unbreakable scientific law','A true and airtight conclusion'], correct: 1 },
          { text: 'A house is built so that all four of its outer walls face south. A bear walks past it. What color is the bear most likely to be?', options: ['Brown','Black','White','Grey'], correct: 2, hard:true },
          { text: 'Two girls share the same mother and were born in the exact same hour, day, and year, yet they are not twins. How is this possible?', options: ['They have different fathers','They are two of a set of triplets or more','The birth records are wrong','It is not actually possible'], correct: 1, hard:true },
          { text: 'A prisoner can ask exactly one guard one question to find the safe door. One guard always lies, the other always tells the truth, and there is no other way to tell them apart. Which question works?', options: ["'Which door is safe?'", "'Are you the one who always lies?'", "'What would the other guard say is the safe door?', then pick the opposite door", "'Do you like your job?'"], correct: 2, hard:true },
          { text: "A wife says, 'I am older than my husband.' Her husband says, 'I am younger than my wife.' At least one of them is lying. Who is actually older?", options: ['The wife','The husband','They are the same age','It cannot be determined'], correct: 1, hard:true },
          { text: 'Vinod had 21 hens. All but 11 of them died. How many hens does Vinod have left?', options: ['10','11','21','0'], correct: 1, hard:true , calc: true },
          { text: 'How many times can you subtract the number 5 from 35?', options: ['7 times','Only once: after that, it is no longer 35','5 times','35 times'], correct: 1, hard:true , calc: true },
          { text: 'A farmer has 20 parrots sitting on a fence. He fires a single shot and hits one. How many parrots are left sitting on the fence?', options: ['19','1','0: the noise scares the rest away','20'], correct: 2, hard:true , calc: true },
          { text: 'A woman has five daughters, and every one of those daughters has exactly one brother. How many children does the woman have in total?', options: ['10','6','11','5'], correct: 1, hard:true , calc: true },
          { text: "On a standard clock, how many times do the hour and minute hands overlap between 12:00 and the following 12:00?", options: ['12 times','11 times','24 times','10 times'], correct: 1, hard:true , calc: true },
          { text: 'Two ropes each take exactly 60 minutes to burn end to end, but burn unevenly along their length. Using matches, how can you measure exactly 45 minutes?', options: ["Light one rope at both ends and the other rope at one end, all at the same time; the instant the first rope finishes burning, light the second rope's other end too: it finishes 45 minutes after the start", 'Light both ropes from one end each, at the same time', 'Cut each rope into four equal-looking pieces and time one piece', "There is no way to measure 45 minutes with these ropes"], correct: 0, hard:true , calc: true },
          { text: 'A driver kept a spare tire with a slow puncture in his trunk for an entire long road trip, yet the puncture never affected the trip at all. How is this possible?', options: ['He never actually needed to use the spare tire', 'He drove an unusually smooth route', 'The puncture sealed itself over time', 'He was not really driving, just being towed'], correct: 0, hard:true },
          { text: "In a simple code, each letter is numbered by counting backward from Z, so Z=1, Y=2, X=3, and so on. What number represents the letter 'C'?", options: ['3', '24', '23', '26'], correct: 1, hard:true , calc: true },
          { text: "In a puzzle, a word's code is the number of distinct (non-repeating) letters it contains: for example 'GOOGLE' has 4 distinct letters (G, O, L, E), so its code is 4. Using that same rule, what is the code for 'LETTERS'?", options: ['5', '6', '7', '8'], correct: 0, hard:true , calc: true },
          { text: 'A 56 cm ribbon needs to be cut into 56 separate 1 cm pieces, at a rate of one cut per second. How many cuts (and seconds) does it actually take?', options: ['56', '55', '28', '1'], correct: 1, hard:true , calc: true },
          { text: 'A shirt costs $20 more than a pair of socks. Together, the shirt and socks cost $30. How much does the shirt cost alone?', options: ['$25', '$20', '$10', '$5'], correct: 0, hard:true , calc: true },
          { text: 'Two trains 300 miles apart head toward each other at 50 mph and 100 mph. At the same moment, a bird starts at one train and flies back and forth between the two trains at 150 mph until they meet. How far does the bird travel in total?', options: ['150 miles', '300 miles', '450 miles', '600 miles'], correct: 1, hard:true , calc: true },
          { text: 'A farmer must cross a river with a wolf, a goat, and a cabbage, but his boat only holds himself plus one item at a time. Left alone together, the wolf eats the goat and the goat eats the cabbage. What should he ferry across first?', options: ['The wolf', 'The cabbage', 'The goat', 'Two items at once'], correct: 2, hard:true },
          { text: 'You have an unmarked 3-gallon jug and an unmarked 5-gallon jug. What is the key first move to eventually measure out exactly 4 gallons?', options: ['Fill the 5-gallon jug completely, then pour it into the 3-gallon jug until that one is full, leaving exactly 2 gallons behind in the 5-gallon jug', 'Fill both jugs completely and combine them', 'Fill the 3-gallon jug and pour it into the 5-gallon jug twice in a row', 'It cannot be done with these two jug sizes'], correct: 0, hard:true , calc: true },
          { text: 'A snail at the bottom of a 10-meter well climbs 3 meters every day but slides back 2 meters every night. On which day does it finally climb out?', options: ['Day 8', 'Day 10', 'Day 7', 'Day 5'], correct: 0, hard:true , calc: true },
          { text: "A is B's mother. B is C's father. D is C's sister. How is A related to D?", options: ['A is D\'s aunt', "A is D's grandmother", "A is D's sister", "A is D's mother"], correct: 1, hard:true },
          { text: "If FLOWER is coded as HNQYGT by shifting every letter forward by 2 places in the alphabet, what is the code for GARDEN using the same rule?", options: ['ICTFGP', 'ICTGFP', 'HCTFGP', 'ICSFGP'], correct: 0, hard:true, calc: true },
          { text: 'A shopkeeper marks up a product by 40% above its cost price, then offers a 25% discount on that marked price. What is the shopkeeper\'s overall profit percentage?', options: ['5%', '10%', '15%', '20%'], correct: 0, calc: true },
          { text: "Three friends split a $150 restaurant bill evenly, but later realize $30 of that bill was a dish only one of them ordered and should pay for alone. How much should each of the other two friends be refunded?", options: ['$10 each', '$15 each', '$5 each', '$20 each'], correct: 0, calc: true },
          { text: 'Five sprinters finish a race. Amy finishes before Beth but after Cid. Dan finishes after Beth. Cid finishes after Eve. What is the finishing order, first to last?', options: ['Eve, Cid, Amy, Beth, Dan', 'Cid, Eve, Amy, Beth, Dan', 'Eve, Amy, Cid, Beth, Dan', 'Amy, Eve, Cid, Beth, Dan'], correct: 0, hard:true },
          { text: 'All engineers are analytical. Some analytical people are creative. Which conclusion follows logically?', options: ['All engineers are creative', 'Some engineers may be creative, but this is not guaranteed by the premises', 'No engineers are creative', 'All creative people are engineers'], correct: 1, hard:true },
          { text: 'What comes next in the sequence: 3, 7, 15, 31, 63, __?', options: ['95', '111', '127', '120'], correct: 2, hard:true, calc: true },
          { text: 'Five years ago, a father was 4 times as old as his son. Today, the father is exactly 3 times as old as his son. How old is the son today?', options: ['10', '12', '15', '18'], correct: 2, calc: true },
          { text: 'You roll two fair six-sided dice at once. What is the probability that the two numbers add up to exactly 7?', options: ['1/6', '1/12', '1/9', '1/8'], correct: 0, hard:true, calc: true },
          { text: 'A container holds 4 liters of a 25% acid solution. How many liters of pure (100%) acid must be added to bring it up to a 40% acid solution?', options: ['1 liter', '2 liters', '1.5 liters', '0.5 liter'], correct: 0, calc: true },
          { text: "A company says its supplement helped 90% of a trial group lose weight, and concludes it must work well for everyone. If the trial only included 10 people, what is the biggest flaw in that reasoning?", options: ['Weight loss studies are inherently unreliable', 'A sample of just 10 people is far too small to confidently generalize to everyone', '90% is not a high enough number to matter', 'Supplements never work, so the result must be fake'], correct: 1, hard:true },
          { text: "In a family, the grandfather's age equals twice the father's age minus 20, and the father's age is exactly 3 times the son's age. If the son is 12, how old is the grandfather?", options: ['52', '56', '48', '44'], correct: 0, calc: true },
          { text: 'A man is found dead in a windowless, locked room. The only things in the room are a puddle of water on the floor and a rope hanging from the ceiling. What most likely happened?', options: ['He was poisoned by something in the room', 'He hanged himself while standing on a block of ice, which then melted', 'He drowned in the puddle of water', 'He fell from the ceiling by accident'], correct: 1, hard:true },
          { text: 'Pipe A can fill a tank in 6 hours on its own, and Pipe B can fill the same tank in 3 hours on its own. If both pipes are opened together, how long will it take to fill the tank?', options: ['2 hours', '1.5 hours', '3 hours', '4.5 hours'], correct: 0, calc: true },
          { text: "On an island, knights always tell the truth and knaves always lie. You meet two islanders, X and Y. X says, 'At least one of us is a knave.' What are X and Y?", options: ['X is a knight, Y is a knave', 'X is a knave, Y is a knight', 'Both are knights', 'Both are knaves'], correct: 0, hard:true },
          { text: "A store advertises 'Buy 2, get 1 free' on items priced at $20 each. If you take advantage of the deal for 3 items, what is the effective discount percentage across all three?", options: ['33.3%', '25%', '50%', '20%'], correct: 0, calc: true },
          { text: "A headline claims 'Ice cream sales cause more shark attacks,' pointing out that both rise together every summer. What's the most likely real explanation?", options: ['Ice cream directly attracts sharks to the coast', 'A third factor (warm weather) independently increases both ice cream sales and beach activity', 'Shark attacks make people crave ice cream afterward', 'The data must have been fabricated'], correct: 1, hard:true },
          { text: 'A number is doubled and then increased by 10. The result equals 3 times the original number. What is the original number?', options: ['10', '5', '15', '20'], correct: 0, calc: true },
          { text: 'Sam never goes hiking if it rains. Last Friday, Sam went hiking. What can you validly conclude about the weather that day?', options: ['It definitely rained', 'It definitely did not rain', 'It might have rained lightly', 'Nothing at all can be concluded'], correct: 1, hard:true },
          { text: 'A rectangular garden has a perimeter of 60 meters, and its length is exactly twice its width. What is the area of the garden?', options: ['200 m²', '150 m²', '180 m²', '160 m²'], correct: 0, calc: true },
          { text: 'Every day a lily pad patch doubles in size, and it takes 48 days to cover an entire lake. On which day was the lake exactly half covered?', options: ['Day 47', 'Day 24', 'Day 46', 'Day 45'], correct: 0, hard:true, calc: true },
          { text: "A judge tells a prisoner: 'You will be executed on one weekday next week, but you will not know which day until the morning it happens.' The prisoner reasons his way to the conclusion that the execution can never happen as described, and is then hanged on Wednesday, completely surprised. What is this paradox best known as?", options: ['The unexpected hanging paradox', "The liar's paradox", "Zeno's paradox", 'The prisoner\u2019s dilemma'], correct: 0, hard:true },
          { text: 'Of 100 people surveyed, 65 like coffee, 55 like tea, and 25 like both. How many like neither coffee nor tea?', options: ['5', '10', '15', '20'], correct: 0, hard:true, calc: true },
          { text: 'A man walks into a bar and asks the bartender for a glass of water. The bartender pulls out a gun and points it at him. The man says "thank you" and calmly walks out. Why?', options: ['The man had a gun of his own', 'The man had the hiccups, and the shock cured them', 'The bartender was joking', 'The man was an actor rehearsing a scene'], correct: 1, hard:true },
          { text: 'A survey found that people who sleep with their shoes on are far more likely to wake up with a headache. What is the most likely explanation?', options: ['Wearing shoes to bed directly causes headaches', 'Both are caused by a third factor, such as drinking heavily the night before', 'Headaches make people want to wear shoes to bed', 'The survey data must be fabricated'], correct: 1, hard:true },
          { text: 'You have 12 identical-looking balls, but one is either heavier or lighter than the rest. Using a balance scale, what is the minimum number of weighings needed to guarantee finding the odd ball and whether it is heavier or lighter?', options: ['3', '2', '4', '5'], correct: 0, hard:true, calc: true },
          { text: 'If it takes 5 machines 5 minutes to make 5 widgets, how long would it take 100 machines to make 100 widgets?', options: ['5 minutes', '100 minutes', '20 minutes', '500 minutes'], correct: 0, hard:true, calc: true },
          { text: 'A bat and a ball together cost $1.10. The bat costs $1.00 more than the ball. How much does the ball cost?', options: ['$0.05', '$0.10', '$0.15', '$1.00'], correct: 0, hard:true, calc: true },
          { text: 'In a certain code language, "PENCIL" is written as "QFODJM" by shifting each letter forward by one place. Using the same rule, how is "BOOK" written?', options: ['CPPL', 'CPOL', 'CQPL', 'BPPL'], correct: 0, hard:true, calc: true },
          { text: "Four people, Anna, Ben, Cara, and Dan, sit at a round table. Anna is not next to Ben. Cara is directly opposite Dan. If Ben is directly opposite Anna, who sits next to both Ben and Cara?", options: ['Dan and Anna', 'Anna and Dan', 'Only Anna', 'Only Dan'], correct: 0, hard:true },
          { text: 'A store raises the price of an item by 20%, then later reduces the new price by 20%. Compared to the original price, the item is now:', options: ['4% cheaper than the original price', 'Exactly the same as the original price', '4% more expensive than the original price', '10% cheaper than the original price'], correct: 0, calc: true },
          { text: 'A tech article claims a new drug "reduces risk of illness by 50%," without mentioning that the baseline risk was already just 1 in 10,000. What is the most important thing missing from that headline?', options: ['The absolute risk reduction, which is what actually matters to an individual', 'The name of the drug company', 'The price of the drug', 'The color of the pill'], correct: 0, hard:true },
          { text: 'A father is 4 times as old as his daughter. In 20 years, he will be twice as old as her. How old is the daughter now?', options: ['10', '12', '8', '15'], correct: 0, calc: true },
          { text: 'Three switches outside a room control three light bulbs inside, but you can only enter the room once. How can you determine which switch controls which bulb?', options: ['Turn on switch 1, wait several minutes, turn it off, then turn on switch 2 and enter: the hot-but-off bulb goes with switch 1, the lit bulb with switch 2, and the cold-off bulb with switch 3', 'Flip all three switches on and off randomly and guess', 'It is impossible to determine with only one entry', 'Turn on all three switches at once and observe brightness differences'], correct: 0, hard:true },
          { text: "You're a contestant on a game show with three doors: one hides a car, two hide goats. You pick door 1. The host, who knows what's behind every door, opens door 3 to reveal a goat, then asks if you want to switch to door 2. What should you do to maximize your odds of winning the car?", options: ['Switch to door 2: it now has a 2/3 chance versus 1/3 for door 1', 'Stay with door 1: switching makes no difference', 'It is now a 50/50 guess either way', 'Ask the host to open door 1 instead'], correct: 0, hard:true, calc: true },
          { text: 'One hundred prisoners are each assigned a random unique number from 1 to 100 and must find their own number in one of 100 closed boxes, opening at most 50 boxes each, with all prisoners freed only if every single one finds their own number. If each prisoner opens the box matching their number, then follows the number found inside to the next box, and so on, what is the strategy exploiting?', options: ['The boxes form permutation cycles, and this strategy finds your number whenever your cycle length is 50 or less', 'Random guessing is actually just as effective', 'The prisoners are colluding by passing notes', 'There is no mathematical structure to exploit; it is pure luck either way'], correct: 0, hard:true },
          { text: 'A weather forecaster says there is a 70% chance of rain tomorrow, and it does not rain. Does this mean the forecaster was wrong?', options: ['Not necessarily: a 70% forecast still allows for a 30% chance of no rain, so one dry day is not strong evidence of error', 'Yes, any forecast above 50% that fails to occur is automatically wrong', 'Yes, because probabilities under 100% should never be trusted', 'No, because weather forecasts are never falsifiable'], correct: 0, hard:true },
          { text: "In a village, every person is either a truth-teller (always honest) or a liar (always dishonest). You meet three villagers, A, B, and C. A says, 'B and C are both liars.' B says, 'A is a liar.' Who is telling the truth?", options: ['Only A is telling the truth', 'Only B is telling the truth', 'A and C are both telling the truth', 'It cannot be determined from this information'], correct: 0, hard:true },
          { text: 'A new screening test for a rare disease is 99% accurate, and the disease affects 1 in 10,000 people. If someone tests positive, what is the most reasonable takeaway about their actual chance of having the disease?', options: ["Despite the test's 99% accuracy, their real chance of having the disease is still low, because false positives from the healthy majority vastly outnumber true positives", 'Their chance of having the disease is 99%, matching the test\'s accuracy', 'The test result tells us nothing useful at all', 'A positive result guarantees the disease is present'], correct: 0, hard:true },
          { text: "A company's new hiring algorithm rejects far more applicants from one demographic than another, even though the algorithm was never given applicants' demographic data directly. What is the most likely explanation?", options: ['The algorithm learned to use correlated proxy variables (like zip code or school name) that indirectly encode the excluded demographic information', 'This outcome is statistically impossible without direct demographic data', 'The algorithm must be broken and producing random results', 'Bias can only occur if a variable is explicitly labeled by demographic group'], correct: 0, hard:true },
          { text: 'Five pirates must vote on how to split 100 gold coins, from most to least senior. Each proposes a split; if at least half the pirates (including the proposer) accept, it passes; otherwise the proposer is thrown overboard and the next-most-senior pirate proposes instead. Assuming every pirate is perfectly rational and wants to survive first, then maximize their own gold, how many coins does the most senior pirate propose to keep?', options: ['98', '20', '0', '50'], correct: 0, hard:true, calc: true },
          { text: 'You are shown four cards on a table, showing D, K, 3, and 7. You are told: "Every card with a vowel on one side has an even number on the other." Which card(s) must you flip to test this rule?', options: ['D and 7', 'D and K', 'D and 3 and 7', 'K and 3'], correct: 0, hard:true },
          { text: 'Two students are told a teacher picked two whole numbers, both greater than 1, whose sum is at most 100. Student A is told only the product, Student B only the sum. A says "I don\'t know the numbers, but I know you don\'t know them either." B replies "Now I know the numbers." A then says "Now I know them too." This puzzle is best known as an example of:', options: ['Reasoning based on common knowledge: what each party can deduce not just from the facts, but from what the other party\'s statements reveal about their own knowledge', 'A trick question with no valid solution', 'Simple arithmetic with a unique answer regardless of the dialogue', 'A probability calculation only'], correct: 0, hard:true },
          { text: 'A politician claims "crime dropped 15% after our new policy," using data compared only to the single highest-crime year on record, rather than the years before or after. What statistical trap does this most likely illustrate?', options: ['Regression to the mean: an unusually extreme year is likely to be followed by a less extreme one regardless of any policy', 'A perfectly valid and unbiased comparison', 'Simpson\'s paradox', 'Survivorship bias'], correct: 0, hard:true },
          { text: 'A cyclist rides from home to work at 20 km/h and returns home along the exact same route at 30 km/h. What is her average speed for the whole round trip?', options: ['24 km/h', '25 km/h', '26 km/h', '23 km/h'], correct: 0, calc: true },
          { text: 'A tank of water is infected with bacteria that double in number every minute. It takes exactly 60 minutes for the bacteria to completely fill the tank. If you started with two tanks of bacteria instead of one (same starting size each), how long would it take to fill one tank?', options: ['59 minutes', '30 minutes', '58 minutes', '55 minutes'], correct: 0, hard:true, calc: true },
          { text: 'A used car is sold for $9,900, which represents a 10% loss on what the seller originally paid for it. What did the seller originally pay?', options: ['$11,000', '$10,890', '$10,000', '$9,000'], correct: 0, calc: true },
          { text: 'In a class, the ratio of boys to girls is 3:5. If 4 more boys join the class, the ratio becomes 1:1. How many students are in the class now?', options: ['20', '16', '24', '28'], correct: 0, calc: true },
          { text: 'Alex is taller than Ben. Cara is shorter than Dan. Ben is taller than Dan. Which of these must be true?', options: ['Alex is taller than Dan', 'Cara is taller than Ben', 'Dan is the shortest of all four', 'Alex is shorter than Cara'], correct: 0, hard:true },
          { text: 'A survey of gym members found that those who track their workouts in an app lose more weight on average than those who do not. A fitness brand concludes the app itself causes weight loss. What is the most likely flaw in that conclusion?', options: ['People motivated enough to consistently track their workouts may already be more disciplined about diet and exercise overall: the motivation, not the app, may be doing the work', 'Apps can never be tested for effectiveness', 'The sample size must have been too small to matter', 'Weight loss cannot be measured accurately by any survey'], correct: 0, hard:true },
          { text: 'A number when divided by 9 leaves a remainder of 4, and when divided by 5 leaves a remainder of 3. What is the smallest such positive number?', options: ['13', '22', '31', '40'], correct: 0, calc: true },
          { text: 'A jar contains only red and blue marbles in a 3:4 ratio. After removing 6 red marbles, the ratio becomes 1:2. How many blue marbles are in the jar?', options: ['16', '12', '20', '24'], correct: 0, calc: true },
          { text: 'Every claim in a debate that is not backed by cited evidence is automatically false. This statement itself provides no citation. What does this reveal?', options: ['The statement is self-refuting: by its own rule, it must be considered false since it cites no evidence for itself', 'The statement is obviously and permanently true', 'This is unrelated to the statement\'s own logical consistency', 'The statement can never be evaluated at all'], correct: 0, hard:true },
          { text: 'Your monthly take-home pay is $3,200. Rent is $1,100, utilities average $180, groceries $400, and you want to save at least 15% of your take-home pay. After those fixed costs and savings, how much is left for everything else?', options: ['$1,040', '$1,520', '$960', '$1,200'], correct: 0, calc: true },
          { text: 'Credit Card A charges 22% APR with no annual fee. Credit Card B charges 15% APR but has a $95 annual fee. If you typically carry a $2,000 balance all year, which card costs you less in total, and by roughly how much?', options: ['Card B costs less, by about $45 (about $300 interest + $95 fee vs about $440 interest)', 'Card A costs less, because it has no annual fee at all', 'They cost exactly the same either way', 'Card B always costs more regardless of balance size'], correct: 0, calc: true },
          { text: 'A landlord requires a security deposit equal to one and a half months\' rent, refundable within 30 days of move-out "minus reasonable deductions," with no further definition given. What is the most reasonable thing to do before signing?', options: ['Ask for "reasonable deductions" to be defined in writing, and document the unit\'s condition with photos before moving in', 'Sign immediately since deposits are always fully refunded eventually', 'Refuse to pay any deposit at all', 'Assume the vague wording does not matter since it is standard'], correct: 0, hard:true },
          { text: 'A store advertises a TV as "was $1,200, now $800: save $400!" You later find the same model has been $900 or lower at other retailers for months. What does this most likely reveal about the "was" price?', options: ['The "was" price may be an inflated reference point designed to make the discount look bigger than it really is', 'The deal is definitely the best price available anywhere', 'The store must be losing money on the sale', 'Nothing: reference prices are always accurate and unbiased'], correct: 0, hard:true },
          { text: 'You have three appointments today: a dentist visit that only offers a slot from 10-11am, a work meeting that could be moved to any time before 3pm, and a friend\'s lunch that was set for 12-1pm weeks ago. A colleague now asks to meet at 10:30am for something "important." What is the most reasonable way to handle it?', options: ['Keep the fixed dentist slot, and ask the colleague if the flexible work meeting time could work instead, since it can be rescheduled without breaking any other commitment', 'Cancel the dentist appointment since colleagues take priority', 'Ignore the colleague\'s request entirely without responding', 'Try to attend all four things by leaving each one early'], correct: 0, hard:true },
          { text: 'A 12 oz bag of chips costs $3.99, and a 16 oz bag of the same chips costs $5.49. Which is the better value per ounce?', options: ['The 12 oz bag: about $0.33/oz versus about $0.34/oz for the 16 oz bag', 'The 16 oz bag is always cheaper per ounce simply because it is bigger', 'They are exactly the same value per ounce', 'The 12 oz bag is dramatically cheaper, by more than 20%'], correct: 0, calc: true },
          { text: 'A recipe calls for 2 teaspoons of baking soda, but you only have baking powder. Baking powder is roughly one-third as potent as baking soda for leavening. Roughly how much baking powder should you substitute to get a similar rise?', options: ['About 6 teaspoons (three times as much)', 'Exactly 2 teaspoons, a 1:1 swap', '2/3 teaspoon, since less is needed', 'Baking powder cannot substitute for baking soda in any recipe'], correct: 0, calc: true },
          { text: 'A car loan offer advertises "0% interest for 60 months," but the same dealer offers a $2,000 cash rebate if you decline the financing and pay a competing lender\'s 4% rate instead. On a $30,000 loan, which option is more likely to save you money overall?', options: ['It depends on the math: the rebate reduces the principal up front, so for many loan sizes and terms, taking the rebate plus a low-interest loan elsewhere can beat "free" financing on the full price', 'The 0% offer is always cheaper because there is no interest at all', 'The rebate option is always worse since it involves paying any interest', 'Both options are mathematically identical in every case'], correct: 0, hard:true },
          { text: 'A friend asks to borrow $500 and promises to pay it back "soon," with no set date. You want to help but also protect the friendship and your finances. What is the most reasonable approach?', options: ['Agree only to an amount you could comfortably treat as a gift if unpaid, and put a specific repayment date in writing to avoid ambiguity later', 'Lend the full amount with no conditions since asking for terms would seem rude', 'Refuse to ever lend money to anyone under any circumstances', 'Lend the money but say nothing if it is never repaid, to avoid conflict'], correct: 0, hard:true },
          { text: 'You are comparing two job offers: Job A pays $65,000 with a 45-minute commute each way and full remote flexibility twice a week; Job B pays $70,000 with a 15-minute commute but no remote days at all. What is the most useful next step before deciding?', options: ['Estimate the real cost of the extra commute time and lost flexibility in Job A against the $5,000 pay difference, based on your own priorities', 'Automatically take Job B since the salary number is higher', 'Automatically take Job A since it has some remote flexibility', 'Flip a coin, since both offers are numerically similar'], correct: 0, hard:true },
          { text: 'A news article claims "9 out of 10 dentists recommend this toothpaste," but does not say how many dentists were asked or how they were selected. What is the biggest reason to be cautious about this claim?', options: ['A vague, unverifiable sample can easily be cherry-picked or too small to represent dentists in general', 'Dentists are never a credible source for toothpaste advice', 'The number 9 out of 10 is mathematically impossible', 'Toothpaste claims are always regulated and therefore always accurate'], correct: 0, hard:true },
          { text: 'A friend says, "I\'ve never been in a car accident, so wearing a seatbelt is pointless for me." What is the clearest flaw in this reasoning?', options: ['Past personal experience of avoiding a rare, high-consequence event does not lower the actual future risk of that event occurring', 'The friend is technically correct and seatbelts are only for people who have crashed before', 'Seatbelts only matter in accidents caused by the driver, not others', 'There is no flaw; this is sound statistical reasoning'], correct: 0, hard:true },
          { text: 'You receive an email claiming to be from your bank, urgently asking you to "verify your account" by clicking a link and entering your password within 24 hours or your account will be closed. What is the most reasonable response?', options: ['Do not click the link; instead, contact the bank directly using a phone number or website you already know to be legitimate', 'Click the link immediately since urgency means it must be important', 'Reply to the email asking for more details before deciding', 'Forward the email to friends to see if they got one too, then decide'], correct: 0, hard:true },
          { text: 'Two employees have the exact same performance review scores. One receives a promotion; the other does not, and is told "it wasn\'t the right time." What is the most reasonable next step for the employee who was passed over?', options: ['Ask their manager directly for specific, concrete criteria on what is needed for the next opportunity', 'Assume it was random and never bring it up again', 'Immediately resign without any further conversation', 'Publicly complain to coworkers about the unfairness'], correct: 0, hard:true },
          { text: 'A social media post claims a common household plant "purifies toxins from the air," citing a decades-old NASA study conducted in a small sealed chamber. What is the key issue with applying that finding to a typical home?', options: ['The sealed lab conditions do not scale to a real room with normal airflow, so the practical air-purifying effect in an actual home is far smaller than implied', 'NASA studies are never trustworthy for any purpose', 'Plants cannot photosynthesize indoors at all', 'The claim is entirely fabricated and no such study exists'], correct: 0, hard:true },
          { text: 'A manager says, "Since our top performer works 60-hour weeks, everyone should work 60-hour weeks to be successful." What is the clearest flaw in this reasoning?', options: ['It assumes correlation between one person\'s hours and success proves causation, ignoring other factors like role, skill, or work efficiency', 'The manager is completely correct and this is sound logic', 'Only that specific employee is capable of working 60 hours', 'Success has never been linked to work hours in any way'], correct: 0, hard:true },
          { text: 'You notice a coworker consistently takes credit for a project you both worked on equally. What is the most constructive first step before escalating the issue?', options: ['Have a direct, calm conversation with the coworker about how credit should be shared going forward', 'Immediately report them to HR without ever speaking to them first', 'Say nothing and let resentment build', 'Start taking credit for their work in return'], correct: 0, hard:true },
          { text: 'A restaurant review site shows an average rating of 4.8 stars from 6 reviews, while a competitor shows 4.3 stars from 3,400 reviews. Which is more likely to reflect the restaurant\'s typical quality?', options: ['The 4.3-star rating, since a much larger sample is far less likely to be skewed by a handful of unusually good or bad experiences', 'The 4.8-star rating, since it is the higher number', 'Both are equally reliable regardless of sample size', 'Neither rating means anything without knowing the reviewers personally'], correct: 0, hard:true },
          { text: 'A friend argues, "Vaccines can\'t be dangerous, because the government would never allow something harmful to be given to millions of people." What kind of reasoning does this rely on?', options: ['An appeal to authority: trusting an institution\'s judgment as proof, rather than evaluating the actual evidence', 'A rigorously proven scientific fact requiring no further evidence', 'A logically airtight deduction', 'An example of correlation being mistaken for causation'], correct: 0, hard:true },
          { text: "A man lives on the 12th floor of an apartment building. Every morning he takes the elevator to the ground floor and leaves. Every evening he takes the elevator back, but only rides it to the 8th floor and walks the rest, unless it's raining, in which case he rides it all the way to the 12th floor. Why?", options: ['He is too short to reach the button for the 12th floor, but on rainy days he uses his umbrella to press it', 'He enjoys the exercise except when it rains', 'The elevator breaks down above the 8th floor on sunny days', 'He is avoiding a neighbor who lives on the 10th floor'], correct: 0, hard:true },
          { text: 'A man pushes his car and stops in front of a hotel, and immediately knows he is bankrupt. What is the most likely explanation?', options: ['He is playing Monopoly, and his car piece landed on a hotel he cannot afford to pay rent on', 'He crashed the car directly into the hotel entrance', 'The hotel refused to let him park his broken-down car', 'He is dreaming and the scenario is not meant to make literal sense'], correct: 0, hard:true },
          { text: "Two fathers and two sons go fishing together. Each catches exactly one fish, yet they bring home only three fish total. How is this possible?", options: ['There are only three people in total: a grandfather, his son, and his son\'s son, so one person is both a father and a son', 'One fish was thrown back after being caught', 'They are counting fish in two different units', 'It is not actually possible as described'], correct: 0, hard:true },
          { text: 'A woman shoots her husband, then holds him underwater for five minutes, then hangs him. Minutes later, they enjoy a lovely dinner together. How is this possible?', options: ['She is a photographer who shot a photo of him, developed the film underwater, and hung it up to dry', 'She actually killed him and this is a false description', 'They are actors rehearsing a violent scene', 'The husband has superhuman durability'], correct: 0, hard:true },
          { text: 'You have an empty 5-liter jug and an empty 3-liter jug, plus unlimited water. What is the fewest number of pours needed to end up with exactly 1 liter in the 3-liter jug?', options: ['4 pours: fill the 3L jug and pour it into the 5L jug, fill the 3L jug again, then pour into the 5L jug until full, which leaves exactly 1 liter behind in the 3L jug', 'It cannot be done with a 5-liter and 3-liter jug', '2 pours', '6 pours'], correct: 0, hard:true },
          { text: 'A boy is walking through a forest and finds a golden ring hanging from a tree branch. He puts it on, and instantly forgets how to speak. What most likely happened?', options: ['The "ring" is actually a bee\'s nest, and he was stung and rushed to get help rather than being unable to speak by choice', 'The ring is cursed and rendered him mute by magic', 'He simply chose not to speak to strangers', 'He was so surprised that he became too shy to talk'], correct: 0, hard:true },
          { text: "You're told: 'If the museum is open, then the gift shop is open. The gift shop is closed.' What can you validly conclude?", options: ['The museum must be closed', 'The museum must be open', 'Nothing can be concluded about the museum', 'The gift shop being closed proves nothing either way'], correct: 0, hard:true },
          { text: 'A father leaves his three sons a herd of 17 camels to be split according to his will: the eldest gets half, the middle son gets a third, and the youngest gets a ninth, with no camel to be cut into pieces. A wise neighbor lends them one extra camel to make the division work evenly, then takes back the same camel afterward. How did the division work out?', options: ['18 camels split as 9, 6, and 2 (using the fractions 1/2, 1/3, 1/9 of 18) uses only 17 camels total, leaving the borrowed camel to be returned', 'The neighbor kept the extra camel as payment', 'It is mathematically impossible and the story has no valid solution', 'Each son simply received exactly 17 divided by 3 camels'], correct: 0, hard:true },
          { text: 'A woman gives one son 10 dollars and another son 45 dollars for their birthdays, even though she loves them equally and both are the same age. What is the most likely reason?', options: ['The money reflects different currencies, ages in different years, or another practical difference not stated, such as one son receiving $10 and the other receiving $45 in a different currency worth less', 'She loves one son more than the other', 'The amounts are typos and should be identical', 'There is no possible non-favoritism explanation'], correct: 0, hard:true },
          { text: "Three friends pay $10 each ($30 total) for a hotel room. The clerk realizes the actual price was $25, so she sends $5 back with the bellhop. The bellhop pockets $2 and gives $1 back to each friend, so each friend effectively paid $9 (3 × $9 = $27). Adding the bellhop's $2 to that $27 gives $29, not the original $30. What happened to the seemingly 'missing' dollar?", options: ["There is no missing dollar: the $27 the friends paid already includes the bellhop's $2 (it covers the $25 room plus his $2), so adding his $2 again is the actual error, not a sign of a lost dollar", 'The hotel secretly kept the missing dollar', 'The bellhop took an extra dollar without anyone noticing', 'The math is genuinely inconsistent and truly cannot be resolved'], correct: 0, hard:true },
          { text: 'A farmer must cross a river with a fox, a chicken, and a bag of grain, using a boat that holds only himself plus one item. Left alone, the fox eats the chicken, and the chicken eats the grain. He ferries the chicken across first, then returns empty. What must he do next to get everyone across safely?', options: ['Take the fox across, then bring the chicken back with him, leave the chicken, take the grain across, and finally return for the chicken', 'Take the grain across next, leaving the fox and chicken together', 'Take the fox and grain together, since neither eats the other', 'It cannot be solved with only one item per trip'], correct: 0, hard:true },
          { text: 'During World War II, engineers studied returning bomber planes and found the most bullet holes clustered on the wings and tail, so they proposed reinforcing those areas. A statistician instead argued for reinforcing the engine and cockpit, which had almost no bullet holes. Why was the statistician right?', options: ['Planes hit in the engine or cockpit likely never made it back to be studied: the missing damage pattern on returning planes reveals where hits were actually fatal', 'The engineers had simply miscounted the bullet holes', 'Wings and tails are structurally impossible to reinforce', 'Both areas needed equal reinforcement regardless of the data'], correct: 0, hard:true },
          { text: 'A single grain of sand is not a "heap." Adding one grain to something that is not a heap also does not make it a heap. Yet a million grains of sand clearly do form a heap. What does this expose?', options: ['The vagueness of everyday categories: there is no single, precise grain-count where "not a heap" suddenly becomes "a heap," even though the extremes are obviously different', 'A simple counting error somewhere in the million grains', 'Proof that heaps do not actually exist', 'A flaw that only applies to sand and no other substances'], correct: 0, hard:true },
          { text: 'A wooden ship has every one of its planks gradually replaced over many years until none of the original wood remains. Someone then uses the discarded original planks to build a second ship. Which one is the "real" original ship?', options: ['There is no universally agreed answer: the puzzle exposes that identity over time is a matter of definition, not a simple fact to look up', 'The one with the replaced planks, since it never stopped sailing', 'The one built from the original planks, since it is made of the original material', 'Both ships are automatically fake since neither is truly continuous'], correct: 0, hard:true },
          { text: "A weather app says there's a 90% chance of sun both today and tomorrow. Someone concludes there's a 90% chance the whole weekend will be sunny. What is the flaw in that reasoning?", options: ['If the two days are independent, the chance of both being sunny is 0.9 × 0.9 = 81%, not 90%: combining probabilities requires multiplying, not just repeating the single-day figure', 'Weather forecasts can never be combined across days for any reason', 'The chance of both days being sunny is actually higher than 90%, not lower', 'This reasoning is completely correct as stated'], correct: 0, hard:true },
          { text: 'A locked-room mystery: a woman is found dead in a room with no windows and only one locked door, bolted from the inside. Beside her is a shattered mirror and a puddle of melted wax on the floor. What is a plausible non-supernatural explanation?', options: ['She lit a candle that caused the fire alarm or drew attention, saw her own frightening reflection in the mirror during a power outage and startled herself into a fatal accident, and the wax simply melted from the candle burning down before anyone found her', 'The room was never actually locked to begin with', 'A ghost caused her death, since no other explanation fits', 'She was killed elsewhere and the body placed there afterward, defeating the locked-room premise entirely'], correct: 0, hard:true },
          { text: "A company's ad claims their new vitamin 'is proven to boost energy' based on a study where participants reported feeling more energetic after taking it, but the study had no placebo group for comparison. What is the biggest problem with this evidence?", options: ['Without a placebo group, there is no way to know if the reported energy boost came from the vitamin itself or simply from participants expecting to feel better', 'Vitamins can never realistically be tested in any scientific study', 'Self-reported energy levels are always completely reliable data', 'The study proves the vitamin works regardless of missing controls'], correct: 0, hard:true },
          { text: 'A rope ladder hangs over the side of a ship, with rungs spaced 30 cm apart. At low tide, 6 rungs are visible above the waterline. The tide rises at a rate of 15 cm per hour. How many rungs will be visible above the waterline after 2 hours?', options: ['6: the ladder rises and falls with the ship, so the number of visible rungs above the waterline never changes regardless of the tide', '2', '0', '4'], correct: 0, hard:true },
          { text: "You're offered a choice between two sealed boxes: Box A definitely contains $1,000. Box B contains either $0 or $1,000,000, decided in advance by a predictor who is almost always correct at predicting whether you'll choose only Box B or both boxes. If you choose only Box B, the predictor (having predicted this) will have already put the $1,000,000 inside. If you choose both boxes, the predictor will have predicted that and left Box B empty. What does this thought experiment primarily illustrate?", options: ['A genuine tension between two reasonable decision strategies: dominance reasoning (take both, since the money is already decided) versus expected-value reasoning (take one, to make the predictor\'s past accuracy work in your favor)', 'There is an obviously correct answer that all rational people agree on', 'The predictor must be lying about their accuracy for the scenario to make sense', 'This is purely a math error with no real philosophical content'], correct: 0, hard:true },
          { text: 'What is the largest mammal in the world?', options: ['African elephant', 'Blue whale', 'Giraffe', 'Polar bear'], correct: 1 },
          { text: 'Which language has the most native speakers worldwide?', options: ['English', 'Spanish', 'Mandarin Chinese', 'Hindi'], correct: 2 },
          { text: 'A cinema sells popcorn in a "small" for $4 and a "large" that is exactly double the volume for $6.50. Which size gives more popcorn per dollar?', options: ['The large: it gives more popcorn per dollar than the small', 'The small: it gives more popcorn per dollar', 'They give exactly the same amount per dollar', 'It depends on the shape of the container'], correct: 0, calc: true },
          { text: 'Which of these vitamins is produced by the human body when skin is exposed to sunlight?', options: ['Vitamin A', 'Vitamin C', 'Vitamin D', 'Vitamin K'], correct: 2 },
          { text: 'If a train travels 240 km in 4 hours, how far will it travel in 7 hours at the same speed?', options: ['420 km', '400 km', '380 km', '360 km'], correct: 0, calc: true },
          { text: 'A father promises his daughter she can stay up late "if she finishes her homework and it isn\'t a school night." Tonight is not a school night, but she has not finished her homework. Can she stay up late?', options: ['No: both conditions joined by "and" must be true, and she has not met the homework condition', 'Yes, since at least one condition is true', 'Yes, because it is not a school night, which was listed second', 'It cannot be determined without more information'], correct: 0, hard:true },
          { text: 'A gym offers Plan A: $40/month with no sign-up fee, or Plan B: $30/month with a one-time $150 sign-up fee. After how many months does Plan A become more expensive in total than Plan B?', options: ['After the 15th month, Plan A costs more in total than Plan B', 'After 5 months', 'After 10 months', 'Plan A is always cheaper, regardless of duration'], correct: 0, hard:true, calc: true },
          { text: 'A person argues, "This new policy must be good because so many people online support it." What is the clearest issue with this reasoning?', options: ['Popularity of an opinion is not the same as evidence that the underlying claim is true or the policy will work well: this is an appeal to popularity', 'Online opinions are always representative of the general public', 'The policy is therefore proven to be effective', 'There is no issue; popularity is sufficient proof on its own'], correct: 0, hard:true },
          { text: 'Which planet in our solar system has the most moons confirmed as of recent counts?', options: ['Jupiter', 'Saturn', 'Uranus', 'Neptune'], correct: 1 },
          { text: 'What is the capital of France?', options: ['Lyon', 'Marseille', 'Paris', 'Nice'], correct: 2 },
          { text: 'Which element has the chemical symbol "O"?', options: ['Osmium', 'Oxygen', 'Gold', 'Iron'], correct: 1 },
          { text: 'A store marks up an item by 25% and then offers a 20% discount off the marked-up price. Compared to the original price, the final price is:', options: ['The same as the original price', '5% higher than the original price', '5% lower than the original price', '10% lower than the original price'], correct: 1, calc: true },
          { text: 'Which of these is an example of a sunk cost?', options: ['Money already spent on a non-refundable ticket', 'The price of a ticket you have not bought yet', 'A discount offered on a future purchase', 'An estimate of next month\'s expenses'], correct: 0 },
          { text: 'How many sides does a hexagon have?', options: ['5', '6', '7', '8'], correct: 1 },
          { text: 'If Anna is taller than Ben, and Ben is taller than Cara, who is the shortest?', options: ['Anna', 'Ben', 'Cara', 'Cannot be determined'], correct: 2 },
          { text: 'Which of these best describes an "ad hominem" argument?', options: ['Attacking the person making a claim instead of the claim itself', 'Providing solid evidence for a claim', 'Restating an opponent\'s argument accurately', 'Appealing to a recognized expert on the topic'], correct: 0, hard: true },
          { text: 'A recipe calls for a ratio of 3 parts flour to 1 part sugar. If you use 12 cups of flour, how much sugar do you need?', options: ['3 cups', '4 cups', '6 cups', '9 cups'], correct: 1, calc: true },
          { text: 'Which of these gases makes up the largest percentage of Earth\'s atmosphere?', options: ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Argon'], correct: 2 },
          { text: 'You read a headline that oversimplifies a study\'s findings to grab attention. What is the most reasonable next step before sharing it?', options: ['Share it immediately since headlines are always accurate', 'Read the actual study or a fuller article to check what it really found', 'Assume the opposite of the headline is true', 'Ignore the topic entirely going forward'], correct: 1, hard: true },
          { text: 'What is the capital of Italy?', options: ['Milan', 'Venice', 'Rome', 'Florence'], correct: 2 },
          { text: 'Which of these numbers is NOT a multiple of 7?', options: ['21', '35', '42', '48'], correct: 3, calc: true },
          { text: 'Which organ in the human body produces insulin?', options: ['Liver', 'Pancreas', 'Kidney', 'Spleen'], correct: 1 },
          { text: 'A car depreciates by 15% each year. If it is worth $20,000 now, what is it worth after one year?', options: ['$17,000', '$18,500', '$16,500', '$19,000'], correct: 0, calc: true },
          { text: 'Which of these is an example of the "false dilemma" fallacy?', options: ['"Either you support this plan completely, or you don\'t care about the problem at all"', '"Studies from three separate sources support this conclusion"', '"This claim was tested and replicated"', '"Experts in the field broadly agree on this point"'], correct: 0, hard: true },
          { text: 'Which of these is the longest river in the world?', options: ['Amazon', 'Nile', 'Yangtze', 'Mississippi'], correct: 1 },
          { text: 'If a pizza is cut into 8 equal slices and you eat 3, what fraction of the pizza is left?', options: ['3/8', '5/8', '1/2', '1/4'], correct: 1, calc: true },
          { text: 'Which of these best describes an opportunity cost?', options: ['The total amount of money spent on a purchase', 'The value of the next best alternative given up when making a choice', 'A cost that has already been paid and cannot be recovered', 'The tax paid on a purchase'], correct: 1 },
          { text: 'Two runners start at the same point; one runs at 6 mph and the other at 8 mph in the same direction. How far apart are they after 2 hours?', options: ['2 miles', '4 miles', '14 miles', '28 miles'], correct: 1, calc: true },
          { text: 'A restaurant bill comes to $48 and you want to leave an 18% tip. Roughly how much should you leave?', options: ['About $6', 'About $8.60', 'About $10', 'About $14'], correct: 1, calc: true },
          { text: 'Your rent is $1,200 a month and you take home $3,600 a month after tax. What percentage of your take-home pay goes to rent?', options: ['25%', '30%', '33%', '40%'], correct: 2, calc: true },
          { text: 'You need to be at the airport 2 hours before a 6:45pm flight, plus 30 minutes to drive there. What time should you leave home?', options: ['3:45pm', '4:00pm', '4:15pm', '4:45pm'], correct: 2, calc: true },
          { text: 'A recipe serves 4 and calls for 2 teaspoons of salt. How much salt is needed to serve 10 people?', options: ['4 teaspoons', '5 teaspoons', '6 teaspoons', '8 teaspoons'], correct: 1, calc: true },
          { text: 'Your credit card charges 20% APR. What does APR stand for?', options: ['Annual Percentage Rate', 'Average Payment Ratio', 'Approved Purchase Report', 'Annual Payment Requirement'], correct: 0 },
          { text: 'You fill your car with 12 gallons of gas at $3.50 per gallon. How much do you pay?', options: ['$36', '$40', '$42', '$45'], correct: 2, calc: true },
          { text: 'A job offer pays $25/hour for a 40-hour work week. What is the approximate gross pay for a full year (52 weeks)?', options: ['$40,000', '$52,000', '$65,000', '$75,000'], correct: 1, calc: true },
          { text: 'You\'re comparing two phone plans: Plan A is $50/month with unlimited data, Plan B is $35/month plus $5 for every extra GB after 5GB. If you typically use 8GB a month, which plan costs less?', options: ['Plan A', 'Plan B', 'They cost the same', 'Cannot be determined'], correct: 1, calc: true, hard: true },
          { text: 'What is the most important reason to keep an emergency fund?', options: ['To earn high investment returns', 'To cover unexpected expenses without going into debt', 'To avoid ever having a budget', 'To qualify for a mortgage'], correct: 1 },
          { text: 'A washing machine cycle uses 40 liters of water and takes 1 hour. If you run 5 loads a week, how many liters does that use in a week?', options: ['150 liters', '175 liters', '200 liters', '250 liters'], correct: 2, calc: true },
          { text: 'You\'re baking and the recipe uses Celsius, but your oven only shows Fahrenheit. The recipe calls for 180°C. Roughly what is that in Fahrenheit?', options: ['About 320°F', 'About 356°F', 'About 400°F', 'About 250°F'], correct: 1, calc: true },
          { text: 'Which of these is generally the most effective way to build an emergency fund over time?', options: ['Waiting for a windfall like a bonus or gift', 'Automatically setting aside a fixed amount from every paycheck', 'Only saving whatever happens to be left at the end of the month', 'Borrowing from a credit card and saving the difference'], correct: 1 },
          { text: 'You have two job offers: $60,000/year with a 45-minute commute each way, or $54,000/year with a 10-minute commute. Roughly how many extra hours per year does the first job cost you in commuting, assuming 5 days a week, 50 weeks a year?', options: ['About 145 hours', 'About 290 hours', 'About 50 hours', 'About 500 hours'], correct: 1, calc: true, hard: true },
          { text: 'Which of these is the best first step when you notice unfamiliar charges on your bank statement?', options: ['Ignore it, since banks rarely make mistakes', 'Contact your bank promptly to report and investigate the charge', 'Close the account without telling the bank', 'Wait until your next statement to see if it happens again'], correct: 1 },
          { text: 'A parking garage charges $5 for the first hour and $2 for each additional hour. How much would 4 hours of parking cost?', options: ['$8', '$11', '$13', '$20'], correct: 1, calc: true },
          { text: 'You\'re splitting a $96 dinner bill evenly among 6 friends, including a 20% tip already included in that total. How much does each person owe?', options: ['$14', '$16', '$18', '$20'], correct: 1, calc: true },
          { text: 'Which of these is generally the most reliable way to check if a job posting or offer is a scam?', options: ['It asks you to pay money upfront for training or equipment', 'It lists a specific salary range', 'It requires a formal interview', 'It is posted on a well-known job site'], correct: 0, hard: true },
          { text: 'A grocery store sells a 500g bag of rice for $2.50 and a 1.5kg bag for $6.00. Which is the better value per gram?', options: ['The 500g bag', 'The 1.5kg bag', 'They are the same value per gram', 'Cannot be determined'], correct: 1, calc: true },
          { text: 'You set three alarms 5 minutes apart to help you wake up: 6:50am, 6:55am, and 7:00am. If you need to leave the house by 7:40am and getting ready takes 35 minutes, which alarm should you actually get up at to be safe?', options: ['6:50am', '6:55am', '7:00am', 'Any of them, since you have plenty of time either way'], correct: 0, calc: true },
        ];

        const hardQuizBank = dailyQuizBank.filter(q => q.hard);

        // ---- Daily quiz flow ----
        function buildDailyQuizQuestions(){
          return shuffleArray(hardQuizBank).slice(0, 16);
        }

        function startDailyQuiz(){
          if (isDailyQuizDoneToday()) {
            pushInAppNotification("Already done for today", "You've completed today's Daily Quiz. Come back tomorrow for a new one!");
            return;
          }
          startQuizSession('dailyQuiz', 'Daily Quiz', 16, buildDailyQuizQuestions());
        }

        function openDailyQuizIntro(){
          if (isDailyQuizDoneToday()) {
            pushInAppNotification("Already done for today", "You've completed today's Daily Quiz. Come back tomorrow for a new one!");
            return;
          }
          openChallengeModal(dailyQuizIntroHTML());
        }

        function dailyQuizIntroHTML(){
          return `
            <div class="text-2xl font-bold text-gray-900 mb-2">Daily Quiz</div>
            <div class="text-sm text-gray-500 mb-5">Test what you know before it resets tomorrow.</div>
            <div class="w-full flex items-center gap-3 rounded-2xl p-4 mb-3" style="background:rgba(65,105,225,0.06);">
              <div class="w-11 h-11 rounded-full flex items-center justify-center text-white flex-shrink-0" style="background:#16a34a;">${Icon('target','w-5 h-5')}</div>
              <div class="flex-1 min-w-0">
                <div class="font-bold text-gray-900 text-sm">You Choose 10</div>
                <div class="text-xs text-gray-500">Flip any 10 of the 16 cards to answer them</div>
              </div>
            </div>
            <div class="w-full flex items-center gap-3 rounded-2xl p-4 mb-5" style="background:rgba(245,158,11,0.1);">
              <div class="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style="background:rgba(30,144,255,0.15);color:${NAVY};">${Icon('coin','w-5 h-5')}</div>
              <div class="flex-1 min-w-0">
                <div class="font-bold text-gray-900 text-sm">20 Coins per Correct Answer</div>
                <div class="text-xs text-gray-500">Coins you can stake later in the Join Quiz</div>
              </div>
            </div>
            <button onclick="closeChallengeModal(); startDailyQuiz();" class="sheet-pill w-full text-center py-3 rounded-2xl text-sm mb-3">Start Quiz</button>
            <button onclick="closeChallengeModal()" class="sheet-pill w-full text-center py-3 rounded-2xl text-sm">Cancel</button>`;
        }

        let quizInviteTarget = null;
        let quizInviteWaitTimer = null;
        let quizSearchStake = quizStakeOptions[0];
        let quizSearchTimer = null;

        // ---- Weekly quiz: join, invite, matchmaking, stakes ----
        function openWeeklyQuizJoin(){
          openChallengeModal(quizJoinChooseHTML());
        }

        function quizJoinChooseHTML(){
          return `
            <button onclick="closeChallengeModal()" class="w-8 h-8 flex items-center justify-center text-gray-600 flex-shrink-0 -ml-1 mb-1">${IconBold('back','w-5 h-5')}</button>
            <div class="text-2xl font-bold text-gray-900 mb-2">Join Quiz</div>
            <div class="text-sm text-gray-500 mb-5">Invite a friend to stake and play together, or get matched with someone online staking the same amount.</div>
            <button onclick="openQuizInviteFriend()" class="w-full flex items-center gap-3 rounded-2xl p-4 mb-3 text-left">
              <div class="w-11 h-11 rounded-full flex items-center justify-center text-white flex-shrink-0" style="background:${NAVY};">${Icon('personPlus','w-5 h-5')}</div>
              <div class="flex-1 min-w-0">
                <div class="font-bold text-gray-900 text-sm">Invite a Friend</div>
                <div class="text-xs text-gray-500">Play someone using their quiz ID</div>
              </div>
            </button>
            <button onclick="openQuizFindMatch()" class="w-full flex items-center gap-3 rounded-2xl p-4 mb-5 text-left">
              <div class="w-11 h-11 rounded-full flex items-center justify-center text-white flex-shrink-0" style="background:#16a34a;">${Icon('search','w-5 h-5')}</div>
              <div class="flex-1 min-w-0">
                <div class="font-bold text-gray-900 text-sm">Find a Match</div>
                <div class="text-xs text-gray-500">Get paired with someone online staking the same amount</div>
              </div>
            </button>`;
        }

        function openQuizInviteFriend(){
          openChallengeModal(quizInviteFriendHTML());
        }

        function quizWinLossBadgeHTML(p){
          if (!p || !(p.wins || p.losses)) return '';
          const green = (p.wins || 0) >= (p.losses || 0);
          return `<div class="absolute -top-1.5 -right-1.5 text-[9px] font-bold text-white rounded-full px-1" style="background:${green ? '#16a34a' : '#dc2626'};line-height:14px;">${p.wins || 0}-${p.losses || 0}</div>`;
        }

        function quizInviteFriendHTML(){
          return `
            <button onclick="openWeeklyQuizJoin()" class="w-8 h-8 flex items-center justify-center text-gray-600 flex-shrink-0 -ml-1 mb-1">${IconBold('back','w-5 h-5')}</button>
            <div class="text-2xl font-bold text-gray-900 mb-2">Invite a Friend</div>
            <div class="text-sm text-gray-500 mb-4">Send a stake invite to a friend's ID, or pick from your quiz friends below.</div>
            <div class="flex gap-2 mb-5">
              <input id="quiz-friend-id-input" type="text" placeholder="Friend's ID (e.g. NEX-1234)" class="flex-1 min-w-0 rounded-2xl px-4 py-3 text-sm font-semibold text-gray-800" style="background:rgba(65,105,225,0.08); border:1px solid rgba(65,105,225,0.2);">
              <button onclick="quizInviteById()" class="sheet-pill text-sm rounded-2xl px-4 flex-shrink-0">Send</button>
            </div>
            ${quizFriends.length ? `
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Your quiz friends</div>
              <div class="space-y-2 mb-5">
                ${quizFriends.map(f => `
                  <button onclick="quizInviteFriendById('${f.id}')" class="w-full flex items-center gap-2.5 rounded-2xl p-3 text-left" style="background:rgba(65,105,225,0.06);">
                    <div class="relative flex-shrink-0">
                      <div class="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-white font-bold" style="background:${f.color};">${f.photo ? `<img src="${f.photo}" class="w-full h-full object-cover">` : escapeHtml(f.name.charAt(0))}</div>
                      ${quizWinLossBadgeHTML(f)}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="font-bold text-gray-900 text-sm truncate">${escapeHtml(f.name)}</div>
                      <div class="text-xs flex items-center gap-1" style="color:${f.online ? '#16a34a' : '#9ca3af'};">
                        <span style="width:6px;height:6px;border-radius:9999px;flex-shrink:0;background:${f.online ? '#16a34a' : '#9ca3af'};"></span>
                        ${f.online ? 'Online' : 'Offline'}
                      </div>
                    </div>
                    ${Icon('coin','w-4 h-4 text-amber-500 flex-shrink-0')}
                  </button>`).join('')}
              </div>` : `<div class="text-sm text-gray-400 mb-5">No quiz friends yet: add someone after a live match and they'll show up here.</div>`}`;
        }

        function quizInviteFriendById(id){
          const friend = quizFriends.find(f => f.id === id);
          if (!friend) return;
          quizInviteTarget = friend;
          openChallengeModal(quizInviteStakeHTML());
        }

        function quizInviteById(){
          const input = document.getElementById('quiz-friend-id-input');
          const id = (input ? input.value : '').trim();
          if (!id) return;
          const existing = quizFriends.find(f => f.id.toLowerCase() === id.toLowerCase());
          const palette = ['#2563eb','#16a34a','#dc2626','#9333ea','#ea580c','#0891b2'];
          quizInviteTarget = existing || {
            id: id.toUpperCase(),
            name: 'Player ' + id.replace(/[^0-9]/g, '').slice(-4).padStart(3, '0'),
            color: palette[Math.floor(Math.random() * palette.length)],
            online: Math.random() > 0.35,
          };
          openChallengeModal(quizInviteStakeHTML());
        }

        function quizInviteStakeHTML(){
          const t = quizInviteTarget;
          return `
            <div class="text-2xl font-bold text-gray-900 mb-2">Invite ${escapeHtml(t.name)}</div>
            <div class="text-sm text-gray-500 mb-5">Choose a stake to send. If they accept, you'll both be matched into the same live quiz.</div>
            <div class="flex items-center justify-between rounded-2xl p-4 mb-5" style="background:rgba(65,105,225,0.08);">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="relative flex-shrink-0">
                  <div class="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold" style="background:${t.color};">${escapeHtml(t.name.charAt(0))}</div>
                  ${quizWinLossBadgeHTML(t)}
                </div>
                <div class="min-w-0">
                  <div class="font-bold text-gray-900 text-sm truncate">${escapeHtml(t.name)}</div>
                  <div class="text-xs" style="color:${t.online ? '#16a34a' : '#9ca3af'};">${t.online ? 'Online' : 'Offline: invite waits until they are'}</div>
                </div>
              </div>
              <div class="text-xs font-semibold text-gray-400 flex-shrink-0">${escapeHtml(t.id)}</div>
            </div>
            <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Choose your stake</div>
            <div class="grid mb-4" style="grid-template-columns:repeat(4,minmax(0,1fr));gap:0.375rem;">
              ${quizStakeOptions.map(amt => `
                <button onclick="sendQuizInvite(${amt})" class="aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 font-bold text-xs ${userCoins < amt ? 'opacity-40 pointer-events-none' : ''}" style="background:rgba(245,158,11,0.12);color:#b45309;">
                  ${Icon('coin','w-3 h-3')} <span>${amt}</span>
                </button>`).join('')}
            </div>
            <div class="text-xs text-gray-400 mb-4 flex items-center gap-1.5">${Icon('coin','w-3.5 h-3.5 text-amber-500')} Balance: ${userCoins.toLocaleString()} coins.</div>
            <button onclick="closeChallengeModal()" class="sheet-pill w-full text-center py-3 rounded-2xl text-sm">Cancel</button>`;
        }

        function sendQuizInvite(amount){
          if (userCoins < amount || !quizInviteTarget) return;
          const target = quizInviteTarget;
          openChallengeModal(quizInvitePendingHTML(amount));
          clearTimeout(quizInviteWaitTimer);
          const delay = target.online ? 1300 + Math.random() * 900 : 3000;
          quizInviteWaitTimer = setTimeout(() => {
            if (!target.online && Math.random() < 0.35) {
              openChallengeModal(quizInviteDeclinedHTML(target));
              return;
            }
            quizOpponent = { id: target.id, name: target.name, color: target.color, wins: target.wins, losses: target.losses };
            joinWeeklyQuizWithStake(amount);
          }, delay);
        }

        function quizInvitePendingHTML(amount){
          const t = quizInviteTarget;
          return `
            <div class="text-center py-4">
              <div class="relative w-20 h-20 mx-auto mb-4">
                <div class="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-white font-bold text-xl" style="background:${t.color};">${t.photo ? `<img src="${t.photo}" class="w-full h-full object-cover">` : escapeHtml(t.name.charAt(0))}</div>
                ${quizWinLossBadgeHTML(t)}
              </div>
              <div class="text-lg font-bold text-gray-900 mb-1">Waiting for ${escapeHtml(t.name)}...</div>
              <div class="text-sm text-gray-500 mb-6">You sent a ${amount}-coin quiz invite. The match starts automatically once they accept.</div>
              <button onclick="cancelQuizInvite()" class="sheet-pill w-full text-center py-3 rounded-2xl text-sm">Cancel Invite</button>
            </div>`;
        }

        function cancelQuizInvite(){
          clearTimeout(quizInviteWaitTimer);
          closeChallengeModal();
        }

        function quizInviteDeclinedHTML(target){
          return `
            <div class="text-center py-4">
              <div class="text-lg font-bold text-gray-900 mb-1">No response from ${escapeHtml(target.name)}</div>
              <div class="text-sm text-gray-500 mb-6">They didn't accept in time, so no coins were staked.</div>
              <button onclick="closeChallengeModal()" class="sheet-pill w-full text-center py-3 rounded-2xl text-sm">Close</button>
            </div>`;
        }

        function openQuizFindMatch(){
          openChallengeModal(quizFindMatchStakeHTML());
        }

        function quizFindMatchStakeHTML(){
          return `
            <button onclick="openWeeklyQuizJoin()" class="w-8 h-8 flex items-center justify-center text-gray-600 flex-shrink-0 -ml-1 mb-1">${IconBold('back','w-5 h-5')}</button>
            <div class="text-2xl font-bold text-gray-900 mb-2">Find a Match</div>
            <div class="text-sm text-gray-500 mb-5">Pick a stake and we'll pair you with an online player staking the same amount.</div>
            <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Choose your stake</div>
            <div class="grid mb-4" style="grid-template-columns:repeat(4,minmax(0,1fr));gap:0.375rem;">
              ${quizStakeOptions.map(amt => `
                <button onclick="startQuizMatchSearch(${amt})" class="aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 font-bold text-xs ${userCoins < amt ? 'opacity-40 pointer-events-none' : ''}" style="background:rgba(245,158,11,0.12);color:#b45309;">
                  ${Icon('coin','w-3 h-3')} <span>${amt}</span>
                </button>`).join('')}
            </div>
            <div class="text-xs text-gray-400 mb-4 flex items-center gap-1.5">${Icon('coin','w-3.5 h-3.5 text-amber-500')} Balance: ${userCoins.toLocaleString()} coins.</div>`;
        }

        function startQuizMatchSearch(amount){
          if (userCoins < amount) return;
          quizSearchStake = amount;
          openChallengeModal(quizSearchingHTML());
          clearTimeout(quizSearchTimer);
          quizSearchTimer = setTimeout(() => {
            quizOpponent = quizOpponentPool[Math.floor(Math.random() * quizOpponentPool.length)];
            openChallengeModal(quizMatchFoundHTML(amount));
          }, 1500 + Math.random() * 1000);
        }

        function cancelQuizMatchSearch(){
          clearTimeout(quizSearchTimer);
          closeChallengeModal();
        }

        function quizSearchingHTML(){
          return `
            <div class="text-center py-6">
              <div class="sheet-top-icon w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center" style="background:rgba(65,105,225,0.12);">${Icon('search','w-7 h-7')}</div>
              <div class="text-lg font-bold text-gray-900 mb-1">Searching for a match...</div>
              <div class="text-sm text-gray-500 mb-6">Looking for someone online staking ${quizSearchStake} coins.</div>
              <button onclick="cancelQuizMatchSearch()" class="sheet-pill w-full text-center py-3 rounded-2xl text-sm">Cancel</button>
            </div>`;
        }

        function quizMatchFoundHTML(amount, added){
          const opponent = quizOpponent || quizOpponentPool[0];
          const friendRecord = quizFriends.find(f => f.id === opponent.id);
          const isFriend = added || !!friendRecord;
          return `
            <div class="text-2xl font-bold text-gray-900 mb-2">Match Found!</div>
            <div class="text-sm text-gray-500 mb-5">Staking ${amount} coins each. Score higher than them to double your stake.</div>
            <div class="flex items-center justify-between rounded-2xl p-4 mb-5" style="background:rgba(65,105,225,0.08);">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="relative flex-shrink-0">
                  <div class="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold" style="background:${opponent.color};">${escapeHtml(opponent.name.charAt(0))}</div>
                  ${quizWinLossBadgeHTML(friendRecord || opponent)}
                </div>
                <div class="min-w-0">
                  <div class="font-bold text-gray-900 text-sm truncate">${escapeHtml(opponent.name)}</div>
                  <div class="text-xs text-gray-500">Opponent</div>
                </div>
              </div>
              ${Icon('bolt','w-5 h-5 text-amber-500 flex-shrink-0')}
              <div class="font-bold text-sm flex-shrink-0" style="color:${NAVY};">You</div>
            </div>
            <button onclick="quizAddFriendFromMatch(${amount})" class="sheet-pill w-full flex items-center justify-center gap-2 text-center py-3 rounded-2xl text-sm mb-3 ${isFriend ? 'opacity-60 pointer-events-none' : ''}">${Icon('personPlus','w-4 h-4')} ${isFriend ? 'Added as Friend' : 'Add as Friend'}</button>
            <button onclick="joinWeeklyQuizWithStake(${amount})" class="sheet-pill w-full text-center py-3 rounded-2xl text-sm">Start Match</button>`;
        }

        function quizAddFriendFromMatch(amount){
          quizAddFriend(quizOpponent);
          openChallengeModal(quizMatchFoundHTML(amount, true));
        }

        function quizAddFriend(person){
          if (!person) return;
          if (!person.id) person.id = 'NEX-' + Math.floor(1000 + Math.random() * 9000);
          if (!quizFriends.some(f => f.id === person.id)) {
            quizFriends.push({ id: person.id, name: person.name, color: person.color, online: true, wins: 0, losses: 0 });
            pushInAppNotification('Friend added', person.name + ' was added to your quiz friends.');
            queueSaveUserState();
          }
        }

        function joinWeeklyQuizWithStake(amount){
          if (userCoins < amount) return;
          userCoins -= amount;
          quizStake = amount;
          quizCoinResult = null;
          quizCoinDelta = 0;
          saveProgress();
          closeChallengeModal();
          startQuizSession('weeklyQuiz', "Overview", 30);
        }

        // ---- Quiz session runner + rewards ----
        function startQuizSession(context, title, count, bank){
          const questions = shuffleArray(bank || dailyQuizBank).slice(0, count).map(q => Object.assign({ meta: title }, q));
          examTest = { title, questions };
          examContext = context;
          examTimerSeconds = 30;
          examMode = 'timed';
          examQIndex = 0;
          examCardOpenIndex = null;
          examAnswers = {};
          if (typeof resetExamGradingState === 'function') resetExamGradingState();
          examMarked = {};
          examLocked = {};
          examTimerHidden = false;
          examDirectionsOpen = false;
          examStage = 'take';
          examResultTab = 'overview';
          examQuestionPickerOpen = false;
          quizTurn = 'me';
          examCardOwner = {};
          quizOpponentAnswers = {};
          clearTimeout(opponentTurnTimer);

          const myToken = ++examLoadToken;
          const ov = document.getElementById('overlay');
          if (!ov) return;
          ov.classList.remove('hidden');
          ov.style.top = OVERLAY_TOP;
          ov.style.paddingTop = '';
          ov.style.bottom = '0';
          if (context === 'weeklyQuiz' || context === 'dailyQuiz') {
            pickRandomQuizBackground();
            applyQuizBackground();
            startQuizMusic();
          } else {
            clearQuizBackground();
            stopQuizMusic();
          }
          ov.innerHTML = examLoadingMarkup();

          let dots = 0;
          const dotTimer = setInterval(() => {
            const el = document.getElementById('exam-loading-text');
            if (!el || myToken !== examLoadToken) { clearInterval(dotTimer); return; }
            dots = (dots + 1) % 4;
            el.textContent = examLoadingLabel() + '.'.repeat(dots);
          }, 350);

          const EXAM_LOAD_MS = 1400;
          setTimeout(() => {
            clearInterval(dotTimer);
            if (myToken === examLoadToken) revealExamTake(myToken);
          }, EXAM_LOAD_MS);
        }

        function applyQuizRewards(correct, total, exitedEarly){
          const perQuestion = examContext === 'weeklyQuiz' ? 30 : 20;
          const perfect = total > 0 && correct === total;
          let earned = correct * perQuestion;
          if (perfect) earned += 50;
          quizPointsEarned = earned;
          quizWasPerfect = perfect;

          if (examContext === 'dailyQuiz') {
            userCoins += earned;
          } else {
            userPoints += earned;
          }
          if ((total ? correct / total : 0) >= 0.7) quizzesWon++;

          if (examContext === 'dailyQuiz') {
            const today = todayStr();
            if (lastDailyQuizDate !== today) {
              userStreak = lastDailyQuizDate === yesterdayStr() ? userStreak + 1 : 1;
              lastDailyQuizDate = today;
            }
          }

          if (examContext === 'weeklyQuiz' && quizStake > 0) {
            if (exitedEarly) {
              quizCoinResult = 'lose';
              quizCoinDelta = -quizStake;
            } else if (correct > quizOpponentScore) {
              quizCoinResult = 'win';
              quizCoinDelta = quizStake * 2;
              userCoins += quizCoinDelta;
            } else if (correct < quizOpponentScore) {
              quizCoinResult = 'lose';
              quizCoinDelta = -quizStake;
            } else {
              quizCoinResult = 'tie';
              quizCoinDelta = quizStake;
              userCoins += quizStake;
            }
            if (quizOpponent) {
              const friend = quizFriends.find(f => f.id === quizOpponent.id);
              if (friend) {
                if (quizCoinResult === 'win') friend.wins = (friend.wins || 0) + 1;
                else if (quizCoinResult === 'lose') friend.losses = (friend.losses || 0) + 1;
              }
            }
          } else {
            quizCoinResult = null;
            quizCoinDelta = 0;
          }

          const me = leaderboard.find(p => p.me);
          if (me) me.pts = userPoints;
          leaderboard.sort((a, b) => b.pts - a.pts);
          saveProgress();
        }

        function coinBadgeHTML(){
          return `
            <div class="flex items-center gap-1 font-bold text-white flex-shrink-0" style="background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:9999px;padding:0.3rem 0.6rem;font-size:0.7rem;">
              <span class="text-amber-400">${Icon('coin','w-3.5 h-3.5')}</span> ${userCoins.toLocaleString()}
            </div>`;
        }



        // ---- Leaderboard + achievements ----




        function joinGameCodeLoadingHTML(){
          return `
            <div class="flex flex-col items-center text-center py-8">
              <div style="position:relative;width:48px;height:48px;" class="mb-4">
                <div style="position:absolute;inset:0;border-radius:9999px;background:conic-gradient(from 90deg, ${NAVY}, ${ROYAL} 45%, rgba(65,105,225,0.15) 45%, rgba(65,105,225,0.15) 100%);-webkit-mask:radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px));mask:radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px));animation:classroom-spin 0.9s linear infinite;"></div>
              </div>
              <div class="text-sm text-gray-500">Checking code…</div>
            </div>`;
        }

        // ---- Anti-cheat: lock screenshot of open question ----
        function lockOpenQuestionForScreenshot(){
          if ((examContext === 'weeklyQuiz' || examContext === 'dailyQuiz') && examCardOpenIndex !== null) {
            const lockedIndex = examCardOpenIndex;
            examLocked[lockedIndex] = true;
            closeFlashcard();
            pushInAppNotification('Question locked', 'A screenshot was detected, so this question is locked and won\'t count toward your score.');
            const resolvedCount = Object.keys(examAnswers).length + Object.keys(examLocked).filter(k => examAnswers[k] === undefined).length;
            if (examTest && resolvedCount === quizBoardTarget()) {
              if (examContext === 'dailyQuiz') finalizeDailyQuizSelection();
              finishExam();
              renderExamTake();
            }
            return true;
          }
          return false;
        }

        let visibilityHideTimer = null;
        document.addEventListener('visibilitychange', function(){
          if (document.hidden) {
            if (lockOpenQuestionForScreenshot()) return;
            clearTimeout(visibilityHideTimer);
            visibilityHideTimer = setTimeout(() => {
              if (document.hidden && examStage === 'take' && examTest) {
                finishExam(true);
                renderExamTake();
              }
            }, 1200);
          } else {
            clearTimeout(visibilityHideTimer);
          }
        });
        window.addEventListener('pagehide', function(){
          if (examStage === 'take' && examTest) finishExam(true);
        });
        document.addEventListener('keyup', function(e){
          if (e.key === 'PrintScreen') lockOpenQuestionForScreenshot();
        });
        window.addEventListener('blur', function(){
          setTimeout(() => {
            if (!document.hidden) lockOpenQuestionForScreenshot();
          }, 50);
        });

        let authPendingEmail = '';   

        const NEVER_EXPIRE_OTP_TRUST_EMAILS = ['dailytheraklick@gmail.com'];
        const AUTH_OTP_TRUST_DAYS = 7;
        // ---- Auth: login/OTP/complete-profile screens ----
        function authOtpTrustKey(email){
          return 'stitch_otp_trust_' + String(email || '').trim().toLowerCase();
        }
        function authIsDeviceTrusted(email){
          const normalized = String(email || '').trim().toLowerCase();
          if (NEVER_EXPIRE_OTP_TRUST_EMAILS.includes(normalized)) return true;
          try {
            const raw = localStorage.getItem(authOtpTrustKey(email));
            if (!raw) return false;
            const verifiedAt = parseInt(raw, 10);
            if (!verifiedAt) return false;
            return (Date.now() - verifiedAt) < AUTH_OTP_TRUST_DAYS * 24 * 60 * 60 * 1000;
          } catch (e) { return false; }
        }
        function authMarkDeviceTrusted(email){
          try { localStorage.setItem(authOtpTrustKey(email), String(Date.now())); } catch (e) {  }
        }

        function landingGoToAuth(mode){
          const landing = document.getElementById('landing-page');
          if (landing) landing.classList.add('landing-hidden');
          authShowLogin();
        }
        // games.js is the last script tag to load, but the landing page's Sign In/Register buttons
        // render (and become clickable) much earlier
        window.landingGoToAuth = landingGoToAuth;
        if (window.__pendingLandingAuthMode) {
          const pending = window.__pendingLandingAuthMode;
          window.__pendingLandingAuthMode = null;
          landingGoToAuth(pending);
        }

        function authBackToLanding(){
          authForgetPendingVerify();
          const landing = document.getElementById('landing-page');
          if (landing) landing.classList.remove('landing-hidden');
          authShowLogin();
        }

        // The Get Started panel is vertically centered, and #auth-gate uses 100dvh which natively
        // tracks the OS keyboard's own slide animation frame by frame
        (function pinAuthGateHeight(){
          const gate = document.getElementById('auth-gate');
          if (!gate) return;
          const vv = window.visualViewport;
          // Height of the gate with the keyboard fully closed
          let restH = window.innerHeight;
          function isTyping(){
            const a = document.activeElement;
            return !!(a && gate.contains(a) && /^(INPUT|TEXTAREA)$/.test(a.tagName));
          }
          function applyStableHeight(){
            const h = vv ? vv.height : window.innerHeight;
            if (!isTyping() && Math.abs(window.innerHeight - h) < 60) {
              restH = h;
              gate.style.height = h + 'px';
            }
          }
          window.__authApplyStable = applyStableHeight;
          function dropNow(){
            if (window.__authResetLift) window.__authResetLift();
            gate.style.transition = 'none';
            gate.style.height = restH + 'px';
            gate.scrollTop = 0;
            try { window.scrollTo(0, 0); } catch (e) {}
          }
          // Height of the phone background artwork (see #auth-gate::before in styles.css)
          function applyBgHeight(){
            if (isTyping()) return;
            const h = Math.round(Math.max(window.innerHeight, vv ? vv.height : 0));
            if (h > 0) gate.style.setProperty('--auth-bg-h', h + 'px');
          }
          function applyStableAll(){ applyStableHeight(); applyBgHeight(); }
          applyStableAll();
          window.addEventListener('resize', applyStableAll);
          window.addEventListener('orientationchange', function(){ setTimeout(applyStableAll, 300); });

          // Lift the focused field above the keyboard. The card is centred with nothing to scroll,
          // so nudge the whole card up by however much the keyboard covers.
          const inner = gate.querySelector('.auth-scroll-inner');
          let liftPx = 0;
          function setLift(px){
            liftPx = Math.max(0, Math.round(px));
            if (!inner) return;
            inner.style.transition = 'transform .12s ease-out';
            inner.style.transform = liftPx ? 'translateY(-' + liftPx + 'px)' : '';
          }
          function resetLiftNow(){
            liftPx = 0;
            if (!inner) return;
            inner.style.transition = 'none';
            inner.style.transform = '';
          }
          window.__authResetLift = resetLiftNow;
          // The app switches on the VirtualKeyboard API (overlaysContent), so in many browsers the page
          // never resizes when the keyboard opens -- read the keyboard's own height as well
          function kbHeight(){
            const v = window.visualViewport;
            let h = v ? Math.max(0, window.innerHeight - v.height - v.offsetTop) : 0;
            const k = navigator.virtualKeyboard;
            if (k && k.boundingRect) h = Math.max(h, Math.round(k.boundingRect.height || 0));
            return h;
          }
          function liftFocusedField(){
            const t = document.activeElement;
            if (!t || !gate.contains(t) || !/^(INPUT|TEXTAREA)$/.test(t.tagName)) return;
            const covered = kbHeight();
            const visibleBottom = window.innerHeight - covered;
            if (covered < 80) { if (liftPx) resetLiftNow(); return; }
            const margin = 16;
            const overflow = t.getBoundingClientRect().bottom - (visibleBottom - margin);
            // overflow is measured with the current lift applied, so add/subtract it to get the target
            setLift(liftPx + overflow);
          }
          document.addEventListener('focusin', function(e){
            if (!gate.contains(e.target) || !/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
            [0, 80, 180, 320, 520].forEach(function(ms){ setTimeout(liftFocusedField, ms); });
          });
          if (vv) {
            vv.addEventListener('resize', function(){
              // keyboard fully gone -> card drops at once, in step with the keyboard
              if (kbHeight() < 60) { resetLiftNow(); return; }
              liftFocusedField();
            });
            vv.addEventListener('scroll', liftFocusedField);
          }
          if (navigator.virtualKeyboard) {
            navigator.virtualKeyboard.addEventListener('geometrychange', function(){
              if (kbHeight() < 60) resetLiftNow(); else liftFocusedField();
            });
          }
          // Keyboard dismissed by tapping away / Done / Go: drop immediately
          document.addEventListener('focusout', function(e){
            if (!gate.contains(e.target) || !/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
            const next = e.relatedTarget;
            if (next && gate.contains(next) && /^(INPUT|TEXTAREA)$/.test(next.tagName)) return;
            dropNow();
          });
          // Keyboard dismissed with the back gesture: the field stays focused and no blur fires,
          // so watch the viewport grow back and treat that as keyboard closed.
          if (vv) {
            let lastVvH = vv.height;
            let closeTimer = null;
            const KEYBOARD_CLOSE_DEBOUNCE_MS = 140;
            const NEAR_FULL_HEIGHT_SLOP = 60;
            vv.addEventListener('resize', function(){
              const grew = vv.height > lastVvH + 60;
              const coveredNow = window.innerHeight - vv.height;
              lastVvH = vv.height;
              if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
              if (!(grew && coveredNow < NEAR_FULL_HEIGHT_SLOP)) return;
              closeTimer = setTimeout(function(){
                closeTimer = null;
                const stillLooksClosed = (window.innerHeight - vv.height) < NEAR_FULL_HEIGHT_SLOP;
                if (!stillLooksClosed) return;
                if (isTyping()) { try { document.activeElement.blur(); } catch (err) {} }
                dropNow();
                applyBgHeight();
              }, KEYBOARD_CLOSE_DEBOUNCE_MS);
            });
          }
        })();

        function authHideAllPanels(){
          const gateEl = document.getElementById('auth-gate');
          if (gateEl) { if (window.__authApplyStable) window.__authApplyStable(); else gateEl.style.removeProperty('height'); }
          ['auth-panel-login','auth-panel-verify','auth-panel-complete-profile','auth-panel-poster-app'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('active');
          });
        }
        // Focuses the email field on the login/Get Started panel
        function authFocusEmailField(){
          const el = document.getElementById('auth-li-email');
          if (el) el.focus();
        }
        // Single onboarding progress bar (#authStepBar), shown on the same row as the back arrow
        // during "Almost there" and the "What brings you here" stages
        function setAuthProgress(segIndex, pct){
          const bar = document.getElementById('authStepBar');
          if (!bar) return;
          bar.classList.remove('seg');
          if (segIndex === null || segIndex === undefined) { bar.classList.remove('show'); return; }
          const START = 12;
          const total = segIndex > 0 ? Math.min(100, START + (Math.max(0, Math.min(100, pct)) * (100 - START)) / 100) : START;
          bar.classList.add('show');
          const fill = document.getElementById('authStepBarFill');
          if (fill) fill.style.width = total + '%';
          bar.setAttribute('aria-valuenow', String(Math.round(total)));
        }
        // Onboarding progress as segments (one per page) instead of one continuous bar
        function setAuthSegments(cur, total){
          const bar = document.getElementById('authStepBar');
          if (!bar) return;
          let row = document.getElementById('authSegRow');
          if (!row) { row = document.createElement('div'); row.id = 'authSegRow'; row.className = 'auth-seg-row'; bar.appendChild(row); }
          row.innerHTML = Array.from({ length: total }, (_, i) => `<i class="${i < cur ? 'f' : ''}"></i>`).join('');
          bar.classList.add('show', 'seg');
          bar.setAttribute('aria-valuenow', String(Math.round(cur / total * 100)));
        }
        function authOnboardingTotal(){ return 1; }
        function authShowLogin(){
          if (window.__stitchInApp) return;
          authHideAllPanels();
          document.getElementById('auth-panel-login').classList.add('active');
          const loginErr = document.getElementById('auth-login-error');
          if (loginErr) loginErr.classList.remove('show');
          document.getElementById('authHeadTitle').textContent = 'Get Started';
          document.getElementById('authHeadSub').textContent = 'Welcome to the Stitch community';
          document.getElementById('authBackBtn').style.display = 'none';
          document.getElementById('authBackToLandingBtn').style.display = 'flex';
          document.getElementById('auth-gate').classList.remove('auth-compact-mode');
          document.getElementById('auth-gate').classList.remove('auth-verify-mode');
          document.getElementById('auth-gate').classList.remove('auth-photo-stage');
          const eyebrow = document.getElementById('authEyebrow');
          if (eyebrow) eyebrow.textContent = 'YOUR WORKSPACE AWAITS';
          setAuthProgress(null);
        }
        // Some mobile browsers (in-app / custom tabs especially) don't shrink the page when the
        // keyboard opens, so the Verify button ends up hidden behind it
        function authFitVerifyToKeyboard(){
          const gate = document.getElementById('auth-gate');
          if (!gate) return;
          const vv = window.visualViewport;
          const verifyActive = gate.classList.contains('auth-verify-mode') && !gate.classList.contains('auth-hidden');
          if (!vv || !verifyActive) { gate.style.removeProperty('height'); return; }
          const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
          if (covered > 80) {
            gate.style.height = vv.height + 'px';
            const cta = document.querySelector('#auth-panel-verify .auth-cta');
            if (cta) setTimeout(() => cta.scrollIntoView({ block: 'end', behavior: 'smooth' }), 60);
          } else {
            gate.style.removeProperty('height');
          }
        }
        if (window.visualViewport && !window.__authVvBound) {
          window.__authVvBound = true;
          window.visualViewport.addEventListener('resize', authFitVerifyToKeyboard);
        }
        // The verify-your-email step is remembered for this tab (sessionStorage) so that if the
        // page gets reloaded while the person is off checking their inbox
        const AUTH_PENDING_VERIFY_KEY = 'stitch_pending_verify_email';
        function authRememberPendingVerify(email){
          try { sessionStorage.setItem(AUTH_PENDING_VERIFY_KEY, String(email || '')); } catch (e) {}
        }
        function authForgetPendingVerify(){
          try { sessionStorage.removeItem(AUTH_PENDING_VERIFY_KEY); } catch (e) {}
        }
        function authIsVerifyScreenActive(){
          const panel = document.getElementById('auth-panel-verify');
          const gate = document.getElementById('auth-gate');
          return !!(panel && panel.classList.contains('active') && gate && !gate.classList.contains('auth-hidden'));
        }
        function authShowVerify(email, restoring){
          if (window.__stitchInApp) return;
          authPendingEmail = email;
          authRememberPendingVerify(email);
          authHideAllPanels();
          document.getElementById('auth-panel-verify').classList.add('active');
          document.getElementById('authHeadTitle').textContent = 'Verify your email';
          document.getElementById('authHeadSub').textContent = 'Enter the code we sent to ' + email;
          setAuthProgress(null);
          document.getElementById('authBackBtn').style.display = 'flex';
          document.getElementById('authBackToLandingBtn').style.display = 'none';
          document.getElementById('auth-gate').classList.add('auth-compact-mode'); document.getElementById('auth-gate').classList.remove('auth-photo-stage');
          // Simple, un-decorated verify screen: no big brand logo, no gradient hero title, and (see
          // auth-verify-mode CSS) pinned near the top of the viewport instead of vertically
          document.getElementById('auth-gate').classList.add('auth-verify-mode');
          const eyebrow = document.getElementById('authEyebrow');
          if (eyebrow) eyebrow.textContent = 'ONE MORE STEP';
          document.getElementById('auth-verify-error').classList.remove('show');
          const emailLabel = document.getElementById('auth-verify-email-label');
          if (emailLabel) emailLabel.textContent = email;
          for (let i = 0; i < 6; i++) { const el = document.getElementById('auth-otp-' + i); if (el) el.value = ''; }
          // When restoring after a reload the code was already sent -- don't email another one.
          if (!restoring) { authSendOtp(); authStartResendCountdown(); }
          else { authStopResendCountdown(); }
          setTimeout(() => { const first = document.getElementById('auth-otp-0'); if (first) first.focus(); }, 50);
        }
        // Shown once, right after the email code is verified, only when this email has no existing
        // Stitch account yet (see authCheckNeedsProfileSetup)
        function authShowCompleteProfile(){
          if (window.__stitchInApp) return;
          // A first-time account: its first Home open skips the shimmer skeleton (see renderFeed).
          window.__stitchFreshSignup = true;
          authMarkOnboardingPending();
          // Never leave the "Signing you in" skeleton cover up in front of onboarding
          try { hideAuthTransitionLoading(true); } catch (e) {}
          authForgetPendingVerify();
          authHideAllPanels();
          document.getElementById('auth-panel-complete-profile').classList.add('active');
          authSetCpBusy(false);
          const err = document.getElementById('auth-complete-profile-error');
          if (err) err.classList.remove('show');
          document.getElementById('authHeadTitle').textContent = 'Almost there';
          document.getElementById('authHeadSub').textContent = "Let's set up your profile";
          document.getElementById('authBackBtn').style.display = 'flex';
          document.getElementById('authBackToLandingBtn').style.display = 'none';
          document.getElementById('auth-gate').classList.add('auth-compact-mode'); document.getElementById('auth-gate').classList.remove('auth-photo-stage');
          document.getElementById('auth-gate').classList.remove('auth-verify-mode');
          const eyebrow = document.getElementById('authEyebrow');
          if (eyebrow) eyebrow.textContent = 'YOUR PROFILE';
          setAuthSegments(1, authOnboardingTotal());
          setTimeout(() => { const first = document.getElementById('auth-cp-fname'); if (first) first.focus(); }, 50);
        }
        // Shown once, right after Complete Profile, so the Career Space "post or explore" question
        // gets answered during onboarding. Reuses the form in jobs.js.
        let authPosterAppStageIdx = 0;
        // A photo picked on the explore/network path is uploaded at final submit (once we know the
        // account exists), not the instant it's picked
        let authPendingPhotoBlob = null;
        // ---- "What brings you here?" chip picker ----
        // Posting and selling are applied for later, from Career Space (not during sign-up)
        const AUTH_INTENT_GROUPS = [
          { title: 'Using Stitch', items: [['explore','Explore','search'],['network','Network','users']] }
        ];
        const AUTH_POST_KEYS = ['jobs','internships','scholarships','courses','others'];
        const AUTH_PAID_KEYS = ['paidcourses','paidclasses','paidmeetings','paidsessions'];
        let authIntentPicks = new Set();
        function authPaidViaChips(){ return AUTH_PAID_KEYS.some(k => authIntentPicks.has(k)); }
        function authApplyIntentPicks(){
          const picks = authIntentPicks;
          const wantsPaid = authPaidViaChips();
          const wantsPost = wantsPaid || AUTH_POST_KEYS.some(k => picks.has(k));
          posterAppDraft.intent = wantsPost ? 'post' : (picks.has('network') && !picks.has('explore') ? 'network' : 'explore');
          posterAppDraft.interests = Array.from(picks);
          posterAppDraft.sellPaid = wantsPaid;
          if (wantsPaid) {
            const course = picks.has('paidcourses');
            const live = picks.has('paidclasses') || picks.has('paidmeetings') || picks.has('paidsessions');
            posterAppDraft.paidType = course && live ? 'both' : (course ? 'courses' : 'meetings');
          } else {
            posterAppDraft.paidType = '';
          }
        }
        function authToggleIntentPick(key){
          if (authIntentPicks.has(key)) authIntentPicks.delete(key); else authIntentPicks.add(key);
          authApplyIntentPicks();
          authPosterAppStageIdx = 0;
          authRenderPosterAppStage();
          const errEl = document.getElementById('auth-poster-app-error');
          if (errEl) errEl.classList.remove('show');
        }
        function authPosterAppStages(){
          // The 'post' path collects everything an admin needs to review and verify a listing poster
          // Sign-up is just this one question: no photo step and no posting application here
          return ['intent'];
          // eslint-disable-next-line no-unreachable
          if (posterAppDraft.intent !== 'post') return ['intent'];
          // Same paid-courses question and follow-ups as the in-app form (posterAppStages in
          // jobs.js): right after the description, before any documents are requested
          const viaChips = authPaidViaChips();
          const list = ['intent', 'role', 'bizname', 'bizestablished', 'bizcategory', 'bizwebsite', 'bizdesc'];
          if (!viaChips) list.push('paidchoice');
          if (posterAppDraft.sellPaid) list.push(...PAID_SELLER_STAGES.filter(st => !(viaChips && st === 'paidtype')));
          list.push('bizdoc', 'iddoc', 'consent', 'photo');
          return list;
        }
        // Questions are grouped into pages so related ones share a screen. Stage ids are the same,
        // a page just renders and checks several at once.
        function authPosterAppPages(){
          const st = authPosterAppStages();
          const pages = [];
          const has = id => st.indexOf(id) >= 0;
          const add = (id, stages, extra) => { const list = stages.filter(has); if (list.length) pages.push(Object.assign({ id, stages: list }, extra || {})); };
          add('intent', ['intent'], { kicker: 'Your goals' });
          add('role', ['role'], { kicker: 'About you' });
          add('business', ['bizname', 'bizestablished', 'bizcategory', 'bizwebsite', 'bizdesc'], { kicker: 'Your business', title: 'Tell us about it', sub: 'A few details about what you do.' });
          add('paidchoice', ['paidchoice']);
          add('paidsell', ['paidtype', 'paidprice', 'paidplan'], { kicker: 'Paid selling', title: 'What will you sell?', sub: 'A few quick questions about your paid listings.' });
          add('paidpay', ['paidpay', 'paidpayout'], { kicker: 'Paid selling', title: 'How you get paid', sub: 'Payment plan and withdrawals.' });
          add('paidconfirm', ['paidconfirm']);
          add('verify', ['bizdoc', 'iddoc'], { kicker: 'Verify', title: "Prove it's really you", sub: 'Two quick uploads. An admin reviews them before you are approved.' });
          add('review', ['consent'], { kicker: 'Review', title: 'Looks good?', sub: 'Check your details, then agree and continue.' });
          add('photo', ['photo'], { kicker: 'Your photo' });
          return pages;
        }
        function authCurrentPage(){
          const pages = authPosterAppPages();
          return pages[Math.min(Math.max(authPosterAppStageIdx, 0), pages.length - 1)];
        }
        function authPosterAppGoTo(id){
          const i = authPosterAppPages().findIndex(pg => pg.id === id);
          if (i >= 0) { authPosterAppStageIdx = i; authRenderPosterAppStage(); }
        }
        function authPosterAppSummaryHTML(){
          const d = posterAppDraft;
          const cat = ((typeof POSTER_CATEGORY_OPTIONS !== 'undefined' ? POSTER_CATEGORY_OPTIONS : []).find(o => o[0] === d.businessCategory) || [])[1] || '-';
          const row = (label, value, page) => `<div class="pa-sumrow"><span class="pa-sumlab">${label}</span><span class="pa-sumval">${value}</span><a href="#" onclick="authPosterAppGoTo('${page}'); return false;" class="pa-edit">Edit</a></div>`;
          const ok = v => v ? '<span style="color:#16a34a;">Uploaded</span>' : '<span style="color:#e11d48;">Missing</span>';
          const selling = d.sellPaid ? (d.paidType === 'both' ? 'Paid courses and spaces' : d.paidType === 'courses' ? 'Paid courses' : 'Paid spaces') : 'Opportunities only';
          return `<div style="margin-bottom:16px;">
            ${row('Business', escapeHtml(d.businessName || '-'), 'business')}
            ${row('Category', escapeHtml(cat), 'business')}
            ${row('Selling', selling, d.sellPaid ? 'paidsell' : 'business')}
            ${row('Documents', ok(d.businessDocumentFile && d.idDocumentFile), 'verify')}
          </div>`;
        }
        function authShowPosterApp(){
          authHideAllPanels();
          document.getElementById('auth-panel-poster-app').classList.add('active');
          const err = document.getElementById('auth-poster-app-error');
          if (err) err.classList.remove('show');
          document.getElementById('authHeadTitle').textContent = 'What brings you here?';
          document.getElementById('authBackBtn').style.display = 'flex';
          document.getElementById('authBackToLandingBtn').style.display = 'none';
          document.getElementById('auth-gate').classList.add('auth-compact-mode'); document.getElementById('auth-gate').classList.remove('auth-photo-stage');
          document.getElementById('auth-gate').classList.remove('auth-verify-mode');
          const eyebrow = document.getElementById('authEyebrow');
          if (eyebrow) eyebrow.textContent = 'ONE LAST STEP';
          if (typeof resetPosterAppDraft === 'function') resetPosterAppDraft();
          authPendingPhotoBlob = null;
          authIntentPicks = new Set();
          posterAppDraft.interests = [];
          authPosterAppStageIdx = 0; authLastRenderedPageId = '';
          authRenderPosterAppStage();
        }
        const authIsPaidStage = (stage) => typeof stage === 'string' && stage.indexOf('paid') === 0;
        function authPosterAppStageHTML(stage){
          // Paid-courses pages are shared with the in-app form so the questions never drift apart.
          if (authIsPaidStage(stage) && typeof posterAppStageHTML === 'function') return posterAppStageHTML(stage);
          const d = posterAppDraft;
          if (stage === 'role') {
            // Same shadowed, icon chips as "What brings you here?" (stitchChipRowHTML in jobs.js);
            // they wrap onto as many rows as needed.
            return `<div class="mb-2">${stitchChipRowHTML(POSTER_ROLE_OPTIONS, k => d.role===k, 'authSetPosterAppRole')}</div>`;
          }
          if (stage === 'bizname') {
            return `
              <div class="mb-2">
                <input type="text" id="auth-bizname-input" oninput="updatePosterAppField('businessName', this.value)" placeholder="e.g. Acme Design Studio" value="${escapeHtml(d.businessName || '')}" class="w-full bg-gray-100 border border-gray-300 rounded-2xl px-4 py-3 text-sm outline-none">
              </div>`;
          }
          if (stage === 'bizestablished') {
            // Typed in a fixed DD/MM/YYYY format (slashes added as they type) instead of the native
            // date picker
            return `
              <div class="mb-2">
                ${posterAppEstablishedInputHTML('auth-bizestablished-input', 'authPosterAppNext()')}
              </div>`;
          }
          if (stage === 'bizcategory') {
            return `<div class="mb-2">${stitchChipRowHTML(POSTER_CATEGORY_OPTIONS, k => d.businessCategory===k, 'authSetPosterAppCategory', true)}</div>`;
          }
          if (stage === 'bizwebsite') {
            return `
              <div class="mb-2">
                <input type="url" id="auth-bizwebsite-input" oninput="updatePosterAppField('businessWebsite', this.value)" placeholder="e.g. yourbusiness.com" value="${escapeHtml(d.businessWebsite || '')}" class="w-full bg-gray-100 border border-gray-300 rounded-2xl px-4 py-3 text-sm outline-none">
                <a href="#" onclick="authPosterAppNext(); return false;" style="font-size:12px;color:#9ca3af;display:block;margin-top:10px;">Skip for now</a>
              </div>`;
          }
          if (stage === 'bizdesc') {
            const wc = posterAppWordCount(d.businessInfo);
            const counterColor = wc >= POSTER_APP_BIZDESC_MIN_WORDS ? '#16a34a' : '#e11d48';
            return `
              <div class="mb-2">
                <textarea id="auth-bizdesc-textarea" maxlength="3000" oninput="updatePosterAppField('businessInfo', this.value); const n=posterAppWordCount(this.value); const c=document.getElementById('auth-bizdesc-counter'); if(c){ c.textContent = n + '/${POSTER_APP_BIZDESC_MIN_WORDS} words minimum'; c.style.color = n>=${POSTER_APP_BIZDESC_MIN_WORDS} ? '#16a34a' : '#e11d48'; }" placeholder="Describe your business and what you'll be posting -- at least ${POSTER_APP_BIZDESC_MIN_WORDS} words." rows="6" class="w-full bg-gray-100 border border-gray-300 rounded-2xl px-4 py-3 text-sm outline-none resize-none">${escapeHtml(d.businessInfo)}</textarea>
                <div id="auth-bizdesc-counter" class="text-right" style="font-size:11px;margin-top:4px;color:${counterColor};">${wc}/${POSTER_APP_BIZDESC_MIN_WORDS} words minimum</div>
              </div>`;
          }
          if (stage === 'bizdoc') {
            return `
              ${posterAppUploadTileHTML({ label: 'Business document', inputId: 'auth-bizdoc-file-input', onSelect: 'authHandleBizDocSelected', onRemove: 'authRemoveBizDoc', file: d.businessDocumentFile, previewUrl: d.businessDocumentPreviewUrl, accept: 'image/*,.pdf', hint: 'A registration certificate, permit, receipt, invoice, or anything else that shows your business is real -- required.' })}`;
          }
          if (stage === 'photo') {
            return `
              <div class="mb-2 flex flex-col items-center gap-3" style="min-height:calc(100dvh - 300px);justify-content:center;">
                <div id="auth-photo-circle" class="auth-tap" role="button" tabindex="0" aria-label="Add a photo" onclick="document.getElementById('auth-photo-file-input').click()" style="width:112px;height:112px;border-radius:9999px;overflow:hidden;background:#fff;border:1.5px dashed #b9d4f7;box-sizing:border-box;display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;-webkit-tap-highlight-color:transparent;">
                  <img id="auth-photo-preview-img" src="" style="display:none;width:100%;height:100%;object-fit:cover;">
                  <span id="auth-photo-placeholder-icon" style="color:#9ca3af;">${Icon('camera','w-8 h-8')}</span>
                </div>
                <input type="file" accept="image/*" id="auth-photo-file-input" class="hidden" onchange="authHandlePhotoSelected(this)">
                
              </div>`;
          }
          if (stage === 'iddoc') {
            // Country is free text
            return `
              <div class="mb-2">
                <label class="pa-lab">Country that issued your ID</label>
                <input type="text" id="auth-idcountry-input" maxlength="2" autocapitalize="characters" oninput="this.value=this.value.toUpperCase(); updatePosterAppField('idCountry', this.value)" placeholder="e.g. GH, NG, US" value="${escapeHtml(d.idCountry || '')}" class="w-full bg-gray-100 border border-gray-300 rounded-2xl px-4 py-3 text-sm outline-none mb-3">
                <label class="pa-lab">Document type</label>
                <select id="auth-idtype-input" onchange="updatePosterAppField('idType', this.value)" class="w-full bg-gray-100 border border-gray-300 rounded-2xl px-4 py-3 text-sm outline-none mb-3">
                  ${POSTER_ID_TYPE_OPTIONS.map(t => `<option value="${escapeHtml(t)}" ${d.idType === t ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}
                </select>
                ${posterAppUploadTileHTML({ label: 'Front Side', inputId: 'auth-iddoc-front-input', onSelect: 'authHandleIdFrontSelected', onRemove: 'authRemoveIdFront', file: d.idDocumentFile, previewUrl: d.idDocumentFrontPreviewUrl })}
                ${posterAppUploadTileHTML({ label: 'Back Side', inputId: 'auth-iddoc-back-input', onSelect: 'authHandleIdBackSelected', onRemove: 'authRemoveIdBack', file: d.idDocumentBackFile, previewUrl: d.idDocumentBackPreviewUrl, hint: 'Skip if your document type has no back, e.g. a passport.' })}
                ${posterAppUploadTileHTML({ label: 'Proof of Residence (optional)', inputId: 'auth-proof-input', onSelect: 'authHandleProofOfResidenceSelected', onRemove: 'authRemoveProofOfResidence', file: d.proofOfResidenceFile, previewUrl: d.proofOfResidencePreviewUrl, hint: 'A utility bill, bank statement, or tenancy agreement can help speed up review.' })}
              </div>`;
          }
          if (stage === 'selfie') {
            // Automated liveness + face-match (Smile ID)
            return `
              <div class="mb-2">
                ${posterAppUploadTileHTML({ label: 'Selfie', inputId: 'auth-selfie-input', onSelect: 'authHandleSelfieSelected', onRemove: 'authRemoveSelfie', file: d.selfieFile, previewUrl: d.selfiePreviewUrl, accept: 'image/*', capture: 'user', live: true, hint: 'Face the camera in good light, with your whole face visible and no sunglasses or hats.' })}
                <div style="font-size:11px;color:#9ca3af;margin-top:4px;">This is only used to confirm it's really you -- we automatically check that it's a live photo and that it matches the ID you just submitted.</div>
              </div>`;
          }
          if (stage === 'consent') {
            // Same markup as the in-app "Apply to post" consent, but links to the pre-login
            // Terms/Privacy modals since the overlay system isn't there yet.
            return typeof posterAppConsentHTML === 'function'
              ? posterAppConsentHTML('auth-poster-app-consent-checkbox', 'setPosterAppConsent(this.checked)', "authShowTerms()", "openFooterInfo('privacy')")
              : '';
          }
          // stage === 'intent': multi-select chips by section. Picking "Post" or "Paid" switches
          // to the poster path and pre-fills the paid-seller answers.
          return `
            <div class="mb-2 auth-intent-chips">
              ${AUTH_INTENT_GROUPS.map(g => `
                <div class="auth-intent-group">
                  <div class="auth-intent-group-title">${g.title}</div>
                  <div class="auth-intent-row">
                    ${g.items.map(([key, label, icon]) => `
                      <button type="button" aria-pressed="${authIntentPicks.has(key)}" onclick="authToggleIntentPick('${key}')" class="auth-intent-chip ${authIntentPicks.has(key) ? 'on' : ''}">
                        ${Icon(icon, 'w-4 h-4')}<span>${label}</span>
                      </button>
                    `).join('')}
                  </div>
                  ${g.note ? `<div class="auth-intent-note">${g.note}</div>` : ''}
                </div>
              `).join('')}
            </div>`;
        }
        function authPosterAppStageSub(stage){
          if (authIsPaidStage(stage) && typeof posterAppStageSub === 'function') return posterAppStageSub(stage);
          if (stage === 'role') return 'Which best describes you?';
          if (stage === 'bizname') return "What's your business called?";
          if (stage === 'bizestablished') return 'When was it established?';
          if (stage === 'bizcategory') return 'What category fits best?';
          if (stage === 'bizwebsite') return 'Website or social link (optional)';
          if (stage === 'bizdesc') return `Describe it -- at least ${POSTER_APP_BIZDESC_MIN_WORDS} words, required`;
          if (stage === 'bizdoc') return 'Anything that proves your business is real, required';
          if (stage === 'photo') return 'Add a profile picture';
          if (stage === 'iddoc') return 'Submit a government-issued ID from any country';
          if (stage === 'selfie') return "A quick live selfie so we can confirm it's really you";
          if (stage === 'consent') return 'Just one more checkbox';
          return 'Pick everything that fits. You can change it later.';
        }
        // A fresh, playful headline per stage instead of a single static "One more thing" sitting
        // there for the whole poster-app flow
        function authPosterAppStageTitle(stage){
          if (authIsPaidStage(stage) && typeof posterAppStageTitle === 'function') return posterAppStageTitle(stage);
          if (stage === 'role') return 'Nice to meet you';
          if (stage === 'bizname') return "What's it called?";
          if (stage === 'bizestablished') return 'A little history';
          if (stage === 'bizcategory') return 'Pick your lane';
          if (stage === 'bizwebsite') return 'Got a link?';
          if (stage === 'bizdesc') return 'In your own words';
          if (stage === 'bizdoc') return 'Paperwork, but quick';
          if (stage === 'photo') return 'Show your face';
          if (stage === 'iddoc') return 'Last one, promise';
          if (stage === 'selfie') return 'Last one, promise';
          if (stage === 'consent') return 'Almost there';
          return 'What brings you here?';
        }
        let authLastRenderedPageId = '';
        function authRenderPosterAppStage(){
          const pages = authPosterAppPages();
          authPosterAppStageIdx = Math.min(Math.max(authPosterAppStageIdx, 0), pages.length - 1);
          const page = pages[authPosterAppStageIdx];
          const stage = page.stages[0];
          const multi = page.stages.length > 1;
          const LABELS = { bizname: 'Business name', bizestablished: 'Established', bizcategory: 'Category', bizwebsite: 'Website or social link (optional)', bizdesc: 'In your own words', paidtype: 'Type', paidprice: 'Roughly what will most listings cost?', paidplan: 'Tell us what you will post', paidpay: '', paidpayout: 'Where should it go?' };
          const container = document.getElementById('auth-poster-app-form-container');
          // Keep the scroll position when only the content inside the same page changes (a tap on a chip,
          // a picked file); a new page starts at the top.
          const scrollers = [document.getElementById('auth-gate'), document.querySelector('#auth-gate .auth-scroll-inner'), document.querySelector('#auth-gate .auth-form-side'), document.scrollingElement];
          const samePage = authLastRenderedPageId === page.id;
          const savedTops = scrollers.map(el => el ? el.scrollTop : 0);
          if (container && samePage) { container.style.minHeight = container.offsetHeight + 'px'; }
          authLastRenderedPageId = page.id;
          if (container) {
            const body = page.stages.map(st => {
              let html = authPosterAppStageHTML(st);
              if (multi) {
                html = html.replace(/onkeydown="if\(event\.key==='Enter'\)\{event\.preventDefault\(\);authPosterAppNext\(\);\}"/g, '')
                  .replace(/<a href="#" onclick="authPosterAppNext\(\); return false;"[^>]*>Skip for now<\/a>/g, '');
              }
              // The in-app form shows a small helper line under each paid question; mirror it here.
              const hint = (authIsPaidStage(st) && st !== 'paidchoice' && typeof posterAppStageHint === 'function') ? posterAppStageHint(st) : '';
              const lab = multi && LABELS[st] ? `<label class="pa-lab">${LABELS[st]}</label>` : '';
              return `<div class="${multi ? 'pa-field' : ''}">${lab}${html}${hint ? `<div class="text-[11px] text-gray-400" style="margin-top:${multi ? 6 : 17}px;">${hint}</div>` : ''}</div>`;
            }).join('');
            container.innerHTML = (page.id === 'review' ? authPosterAppSummaryHTML() : '') + body;
            container.classList.add('pa-flow');
            const restore = () => scrollers.forEach((el, i) => { if (el) el.scrollTop = samePage ? savedTops[i] : 0; });
            restore();
            requestAnimationFrame(() => { restore(); container.style.minHeight = ''; });
          }
          const errEl = document.getElementById('auth-poster-app-error');
          if (errEl) { errEl.classList.remove('show'); errEl.textContent = "Couldn't save that. Please check your connection and try again."; }
          const title = document.getElementById('authHeadTitle');
          if (title) title.textContent = page.title || authPosterAppStageTitle(stage);
          const sub = document.getElementById('authHeadSub');
          if (sub) sub.textContent = page.sub || authPosterAppStageSub(stage);
          const eyebrow = document.getElementById('authEyebrow');
          if (eyebrow) eyebrow.textContent = `STEP ${authPosterAppStageIdx + 2} OF ${pages.length + 1}${page.kicker ? ' · ' + page.kicker.toUpperCase() : ''}`;
          setAuthSegments(authPosterAppStageIdx + 2, pages.length + 1);
          // Back navigation through the poster-app sub-stages goes through the single fixed top-left
          // arrow (#authBackBtn)
          const authGateEl = document.getElementById('auth-gate');
          if (authGateEl) authGateEl.classList.toggle('auth-photo-stage', stage === 'photo');
          const continueBtn = document.getElementById('auth-poster-app-continue-btn');
          if (continueBtn) {
            continueBtn.style.display = stage === 'photo' ? 'none' : 'block';
            continueBtn.textContent = (authPosterAppStageIdx >= pages.length - 1) ? 'Finish' : 'Continue';
          }
          // "Skip for now" on the photo step lives in the footer at the bottom of the screen
          const skipPhotoBtn = document.getElementById('auth-photo-skip-btn');
          if (skipPhotoBtn) skipPhotoBtn.style.display = stage === 'photo' ? 'block' : 'none';
        }
        function authSetPosterAppIntent(intent){
          posterAppDraft.intent = intent;
          // Changing intent changes which stage list applies
          authPosterAppStageIdx = 0;
          authRenderPosterAppStage();
        }
        function authSetPosterAppRole(role){
          posterAppDraft.role = role;
          authRenderPosterAppStage();
        }
        function authSetPosterAppCategory(category){
          posterAppDraft.businessCategory = category;
          authRenderPosterAppStage();
        }
        function authHandleBizDocSelected(input){
          const file = input.files && input.files[0];
          if (!file) return;
          if (typeof validateOrRejectFile === 'function' && !validateOrRejectFile(input, file, 'bizDoc')) return;
          if (typeof posterAppRevokePreviewUrl === 'function') posterAppRevokePreviewUrl(posterAppDraft.businessDocumentPreviewUrl);
          posterAppDraft.businessDocumentFile = file;
          posterAppDraft.businessDocumentName = 'Paperwork';
          posterAppDraft.businessDocumentPreviewUrl = /^image\//.test(file.type || '') ? URL.createObjectURL(file) : '';
          authRenderPosterAppStage();
        }
        function authRemoveBizDoc(){
          if (typeof posterAppRevokePreviewUrl === 'function') posterAppRevokePreviewUrl(posterAppDraft.businessDocumentPreviewUrl);
          posterAppDraft.businessDocumentFile = null;
          posterAppDraft.businessDocumentName = '';
          posterAppDraft.businessDocumentPreviewUrl = '';
          authRenderPosterAppStage();
        }
        // Front/back/proof-of-residence handlers for onboarding
        function authHandleIdFrontSelected(input){
          const file = input.files && input.files[0];
          if (!file) return;
          if (typeof posterAppRevokePreviewUrl === 'function') posterAppRevokePreviewUrl(posterAppDraft.idDocumentFrontPreviewUrl);
          posterAppDraft.idDocumentFile = file;
          posterAppDraft.idDocumentName = file.name || 'Document selected';
          posterAppDraft.idDocumentFrontPreviewUrl = /^image\//.test(file.type || '') ? URL.createObjectURL(file) : '';
          posterAppDraft.idDocumentVerifiedFile = null;
          authRenderPosterAppStage();
        }
        function authRemoveIdFront(){
          if (typeof posterAppRevokePreviewUrl === 'function') posterAppRevokePreviewUrl(posterAppDraft.idDocumentFrontPreviewUrl);
          posterAppDraft.idDocumentFile = null;
          posterAppDraft.idDocumentName = '';
          posterAppDraft.idDocumentFrontPreviewUrl = '';
          posterAppDraft.idDocumentVerifiedFile = null;
          authRenderPosterAppStage();
        }
        function authHandleIdBackSelected(input){
          const file = input.files && input.files[0];
          if (!file) return;
          if (typeof posterAppRevokePreviewUrl === 'function') posterAppRevokePreviewUrl(posterAppDraft.idDocumentBackPreviewUrl);
          posterAppDraft.idDocumentBackFile = file;
          posterAppDraft.idDocumentBackName = file.name || 'Document selected';
          posterAppDraft.idDocumentBackPreviewUrl = /^image\//.test(file.type || '') ? URL.createObjectURL(file) : '';
          authRenderPosterAppStage();
        }
        function authRemoveIdBack(){
          if (typeof posterAppRevokePreviewUrl === 'function') posterAppRevokePreviewUrl(posterAppDraft.idDocumentBackPreviewUrl);
          posterAppDraft.idDocumentBackFile = null;
          posterAppDraft.idDocumentBackName = '';
          posterAppDraft.idDocumentBackPreviewUrl = '';
          authRenderPosterAppStage();
        }
        function authHandleProofOfResidenceSelected(input){
          const file = input.files && input.files[0];
          if (!file) return;
          if (typeof posterAppRevokePreviewUrl === 'function') posterAppRevokePreviewUrl(posterAppDraft.proofOfResidencePreviewUrl);
          posterAppDraft.proofOfResidenceFile = file;
          posterAppDraft.proofOfResidenceName = file.name || 'Document selected';
          posterAppDraft.proofOfResidencePreviewUrl = /^image\//.test(file.type || '') ? URL.createObjectURL(file) : '';
          authRenderPosterAppStage();
        }
        function authRemoveProofOfResidence(){
          if (typeof posterAppRevokePreviewUrl === 'function') posterAppRevokePreviewUrl(posterAppDraft.proofOfResidencePreviewUrl);
          posterAppDraft.proofOfResidenceFile = null;
          posterAppDraft.proofOfResidenceName = '';
          posterAppDraft.proofOfResidencePreviewUrl = '';
          authRenderPosterAppStage();
        }
        // Live selfie for the automated liveness + face-match check
        function authHandleSelfieSelected(input){
          const file = input.files && input.files[0];
          if (!file) return;
          if (typeof posterAppRevokePreviewUrl === 'function') posterAppRevokePreviewUrl(posterAppDraft.selfiePreviewUrl);
          posterAppDraft.selfieFile = file;
          posterAppDraft.selfieName = file.name || 'Selfie captured';
          posterAppDraft.selfiePreviewUrl = /^image\//.test(file.type || '') ? URL.createObjectURL(file) : '';
          authRenderPosterAppStage();
        }
        function authRemoveSelfie(){
          if (typeof posterAppRevokePreviewUrl === 'function') posterAppRevokePreviewUrl(posterAppDraft.selfiePreviewUrl);
          posterAppDraft.selfieFile = null;
          posterAppDraft.selfieName = '';
          posterAppDraft.selfiePreviewUrl = '';
          authRenderPosterAppStage();
        }
        // Quick client-side square center-crop (no interactive cropper during onboarding
        function authHandlePhotoSelected(input){
          const file = input.files && input.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = function(ev){
            const img = new Image();
            img.onload = function(){
              const side = Math.min(img.width, img.height);
              const sx = (img.width - side) / 2;
              const sy = (img.height - side) / 2;
              const canvas = document.createElement('canvas');
              canvas.width = 640; canvas.height = 640;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, sx, sy, side, side, 0, 0, 640, 640);
              canvas.toBlob(blob => {
                if (!blob) return;
                // Only reached by the explore/network path now
                authPendingPhotoBlob = blob;
                const previewImg = document.getElementById('auth-photo-preview-img');
                const placeholder = document.getElementById('auth-photo-placeholder-icon');
                if (previewImg) { previewImg.src = canvas.toDataURL('image/jpeg', 0.9); previewImg.style.display = 'block'; }
                if (placeholder) placeholder.style.display = 'none';
                const errNow = document.getElementById('auth-poster-app-error');
                if (errNow) errNow.classList.remove('show');
                const addBtn = document.getElementById('auth-photo-add-btn');
                if (addBtn) addBtn.textContent = 'Change photo';
                // A photo is now staged
                const continueBtn = document.getElementById('auth-poster-app-continue-btn');
                if (continueBtn) continueBtn.style.display = 'block';
                const skipPhotoBtn = document.getElementById('auth-photo-skip-btn');
                if (skipPhotoBtn) skipPhotoBtn.style.display = 'none';
              }, 'image/jpeg', 0.9);
            };
            img.onerror = function(){
              const err = document.getElementById('auth-poster-app-error');
              if (err) { err.textContent = "That photo couldn't be read. Please try a JPG or PNG."; err.classList.add('show'); }
            };
            img.src = ev.target.result;
          };
          reader.readAsDataURL(file);
          try { input.value = ''; } catch (e) {}
        }
        function authPosterAppBack(){
          if (authPosterAppStageIdx > 0) {
            authPosterAppStageIdx--;
            authRenderPosterAppStage();
          }
        }
        // "Skip for now" on the photo step: turns solid blue with a spinner so people can see it's working
        async function authSkipPhoto(){
          const btn = document.getElementById('auth-photo-skip-btn');
          if (btn && btn.classList.contains('loading')) return;
          if (btn) { btn.classList.add('loading'); btn.textContent = 'Skipping…'; }
          try { await authPosterAppNext(); }
          finally {
            if (btn) { btn.classList.remove('loading'); btn.textContent = 'Skip for now'; }
          }
        }
        async function authPosterAppNext(){
          const stages = authPosterAppPages();
          for (const cur of authCurrentPage().stages) {
          if (cur === 'intent' && authIntentPicks.size === 0) {
            const errEl = document.getElementById('auth-poster-app-error');
            if (errEl) { errEl.textContent = 'Pick at least one to continue.'; errEl.classList.add('show'); }
            return;
          }
          // A half-typed or impossible "date established" (e.g. 31/02/2020) shouldn't slide through
          if (cur === 'bizestablished' && typeof posterAppEstablishedError === 'function') {
            const dateErr = posterAppEstablishedError();
            if (dateErr) {
              const errEl = document.getElementById('auth-poster-app-error');
              if (errEl) { errEl.textContent = dateErr; errEl.classList.add('show'); }
              return;
            }
          }
          // Same rule as the in-app "Apply to post" form (posterAppStageError in jobs.js): can't
          // move past the consent checkbox unticked
          if (cur === 'bizdesc' && typeof posterAppBizdescError === 'function') {
            const descErr = posterAppBizdescError();
            if (descErr) {
              const errEl = document.getElementById('auth-poster-app-error');
              if (errEl) { errEl.textContent = descErr; errEl.classList.add('show'); }
              return;
            }
          }
          // Paid-courses pages: same rules as the in-app form (posterAppStageError in jobs.js).
          if (authIsPaidStage(cur) && typeof posterAppStageError === 'function') {
            const paidErr = posterAppStageError(cur);
            if (paidErr) {
              const errEl = document.getElementById('auth-poster-app-error');
              if (errEl) { errEl.textContent = paidErr; errEl.classList.add('show'); }
              return;
            }
          }
          if (cur === 'consent' && !posterAppDraft.consent) {
            const errEl = document.getElementById('auth-poster-app-error');
            if (errEl) { errEl.textContent = 'Please agree to the Terms of Service and Privacy Policy to continue.'; errEl.classList.add('show'); }
            return;
          }
          // Same rule as the in-app "Apply to post" form (posterAppStageError in jobs.js): proof the
          // business is real is required, not optional
          if (cur === 'bizdoc' && !posterAppDraft.businessDocumentFile) {
            const errEl = document.getElementById('auth-poster-app-error');
            if (errEl) { errEl.textContent = 'Please upload something that proves your business is real to continue.'; errEl.classList.add('show'); }
            return;
          }
          if (cur === 'iddoc' && !posterAppDraft.idDocumentFile) {
            const errEl = document.getElementById('auth-poster-app-error');
            if (errEl) { errEl.textContent = 'Please submit an ID to continue.'; errEl.classList.add('show'); }
            return;
          }
          if (cur === 'iddoc' && !(posterAppDraft.idCountry || '').trim()) {
            const errEl = document.getElementById('auth-poster-app-error');
            if (errEl) { errEl.textContent = 'Please tell us which country issued your ID.'; errEl.classList.add('show'); }
            return;
          }
          // Same AI-backed check as the in-app "Apply to post" form (posterAppVerifyIdDocument in
          // jobs.js)
          if (cur === 'iddoc' && typeof posterAppVerifyIdDocument === 'function') {
            const continueBtn = document.getElementById('auth-poster-app-continue-btn');
            const originalLabel = continueBtn ? continueBtn.textContent : '';
            if (continueBtn) { continueBtn.disabled = true; continueBtn.textContent = 'Checking ID…'; }
            const ok = await posterAppVerifyIdDocument('auth-poster-app-error');
            if (continueBtn) { continueBtn.disabled = false; continueBtn.textContent = originalLabel; }
            if (!ok) return;
          }
          // Same rule as the in-app "Apply to post" form (posterAppStageError in jobs.js): a live
          // selfie is required for the automated liveness + face-match check
          }
          if (authPosterAppStageIdx < stages.length - 1) {
            authPosterAppStageIdx++;
            authRenderPosterAppStage();
            return;
          }
          await authSubmitPosterApp();
        }
        // The ONLY place a new account's profile is written (name, username, onboarded flag)
        async function authCommitNewAccount(){
          if (typeof saveUserStateNow === 'function') { try { await saveUserStateNow(); } catch (e) {} }
          if (typeof syncPublicProfile === 'function') { try { await syncPublicProfile(); } catch (e) {} }
          authProfileJustCompleted = true;
          try { await authMarkOnboarded(); } finally { authProfileJustCompleted = false; }
          const committedOk = (await authCheckNeedsProfileSetup()) === false;
          if (committedOk) authClearOnboardingPending();
          return committedOk;
        }
        // Backing out of onboarding before the end: the half-made sign-in must not turn into an
        // account
        async function authAwaitPendingDiscard(){
          try { if (window.__authDiscardPromise) await window.__authDiscardPromise; } catch (e) {}
        }
        async function authDiscardUnfinishedAccount(){
          try {
            if ((await authCheckNeedsProfileSetup()) === true && typeof deleteAccountRemote === 'function') {
              await deleteAccountRemote();
            }
          } catch (e) {}
          try { const sb = getSupabaseClient(); if (sb) await sb.auth.signOut().catch(() => {}); } catch (e) {}
          try { resetCachedAuthUser(); } catch (e) {}
          authClearOnboardingPending();
          if (typeof profileData !== 'undefined') { profileData.name = ''; profileData.username = ''; }
        }
        let authSubmittingPosterApp = false;
        async function authSubmitPosterApp(){
          if (authSubmittingPosterApp) return;
          // Belt-and-suspenders alongside the stage-level UI
          if (posterAppDraft.intent === 'post' && (!posterAppDraft.businessDocumentFile || !posterAppDraft.idDocumentFile || !(posterAppDraft.idCountry || '').trim() || !posterAppDraft.consent)) {
            const err = document.getElementById('auth-poster-app-error');
            if (err) {
              err.textContent = !posterAppDraft.businessDocumentFile ? 'Please upload something that proves your business is real.' : !posterAppDraft.idDocumentFile ? 'Please submit an ID to continue.' : !(posterAppDraft.idCountry || '').trim() ? 'Please tell us which country issued your ID.' : 'Please agree to the Terms of Service and Privacy Policy to continue.';
              err.classList.add('show');
            }
            return;
          }
          if (posterAppDraft.intent === 'post' && posterAppDraft.sellPaid && typeof paidSellerMissingFieldMessage === 'function') {
            const paidMissing = paidSellerMissingFieldMessage();
            if (paidMissing) {
              const err = document.getElementById('auth-poster-app-error');
              if (err) { err.textContent = paidMissing; err.classList.add('show'); }
              return;
            }
          }
          authSubmittingPosterApp = true;
          const btn = document.getElementById('auth-poster-app-continue-btn');
          if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; btn.textContent = 'Sending…'; }
          // Only now -- at the very last button -- does the account actually get created.
          const committed = await authCommitNewAccount();
          if (!committed) {
            authSubmittingPosterApp = false;
            const err = document.getElementById('auth-poster-app-error');
            if (err) { err.textContent = "We couldn't finish setting up your account. Check your connection and try again."; err.classList.add('show'); }
            if (btn) { btn.disabled = false; btn.style.opacity = ''; btn.textContent = 'Continue'; }
            return;
          }
          // Explore/network picked a profile photo instead of the business questions
          if (authPendingPhotoBlob) {
            try {
              let remoteUrl = await uploadProfilePhotoToStorage(authPendingPhotoBlob);
              if (!remoteUrl) remoteUrl = await uploadProfilePhotoToStorage(authPendingPhotoBlob);
              if (remoteUrl && typeof profileData !== 'undefined') {
                profileData.photo = remoteUrl;
                profileData.photoCleared = false;
                if (typeof saveUserStateNow === 'function') { try { await saveUserStateNow(); } catch (e) {} }
                if (typeof syncPublicProfile === 'function') { try { await syncPublicProfile(); } catch (e) {} }
              }
            } catch (e) { /* onboarding shouldn't block account creation over a photo upload hiccup */ }
          }
          let ok = typeof submitPosterApplication === 'function' ? await submitPosterApplication() : true;
          // Explore/network people aren't applying for anything
          if (!ok && posterAppDraft.intent !== 'post') ok = true;
          authSubmittingPosterApp = false;
          if (!ok) {
            const err = document.getElementById('auth-poster-app-error');
            if (err) err.classList.add('show');
            if (btn) { btn.disabled = false; btn.style.opacity = ''; btn.textContent = 'Continue'; }
            return;
          }
          // No full-screen "Creating your account" cover
          await authEnterApp();
          hideAuthTransitionLoading(true);
        }
        // One dispatcher for the fixed top-left arrow (#authBackBtn). It EXITS onboarding from any page.
        // The "Back" pill at the bottom (authFlowBack) is what goes one page back.
        function authGoBack(){
          authForgetPendingVerify();
          const posterPanel = document.getElementById('auth-panel-poster-app');
          const profilePanel = document.getElementById('auth-panel-complete-profile');
          const inOnboarding = !!((posterPanel && posterPanel.classList.contains('active')) || (profilePanel && profilePanel.classList.contains('active')));
          if (inOnboarding) { authExitOnboarding(); return; }
          authShowLogin();
        }
        // ---- An unfinished sign-up must never turn into an account ----
        // While onboarding is on screen the account is only "pending". If the page closes before the
        // last pill, the half-made account is deleted.
        function authOnboardingActive(){
          const a = document.getElementById('auth-panel-complete-profile');
          const b = document.getElementById('auth-panel-poster-app');
          return !!((a && a.classList.contains('active')) || (b && b.classList.contains('active')));
        }
        function authMarkOnboardingPending(){
          try {
            getCachedAuthUser().then(function(u){
              if (u && u.id) { try { localStorage.setItem('stitchOnboardingPending', u.id); } catch (e) {} }
            }).catch(function(){});
            getAuthAccessToken().then(function(t){ window.__authOnboardToken = t || null; }).catch(function(){});
          } catch (e) {}
        }
        function authClearOnboardingPending(){
          try { localStorage.removeItem('stitchOnboardingPending'); } catch (e) {}
          window.__authOnboardToken = null;
        }
        window.addEventListener('pagehide', function(ev){
          try {
            if (ev && ev.persisted) return;
            if (authSubmittingPosterApp || authCompletingProfile || !authOnboardingActive()) return;
            const t = window.__authOnboardToken;
            if (!t) return;
            fetch('https://' + SUPABASE_PROJECT_REF + '.supabase.co/functions/v1/delete-account', {
              method: 'POST', keepalive: true,
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + t, 'apikey': SUPABASE_ANON_KEY },
            });
            try { localStorage.removeItem('stitchOnboardingPending'); } catch (e) {}
          } catch (e) {}
        });
        // At the next open: an account that was left mid-onboarding is removed, and the person lands
        // on the login screen
        async function authDiscardStalePendingOnboarding(){
          let pend = null;
          try { pend = localStorage.getItem('stitchOnboardingPending'); } catch (e) {}
          if (!pend) return;
          try {
            const sb = getSupabaseClient();
            if (!sb) return;
            const { data } = await sb.auth.getSession();
            const user = data && data.session && data.session.user;
            if (user && user.id === pend) {
              await authDiscardUnfinishedAccount();
              authClearOnboardingPending();
              location.replace(location.pathname);
              return;
            }
          } catch (e) {}
          authClearOnboardingPending();
        }
        // Leaving onboarding abandons sign-up: no account is kept
        function authExitOnboarding(){
          authForgetPendingVerify();
          authShowLogin();
          window.__authDiscardPromise = authDiscardUnfinishedAccount().catch(() => {}).finally(() => { window.__authDiscardPromise = null; });
        }
        // The floating "Back" pill: one page back at a time. From the very first onboarding page
        // there is no earlier page, so it leaves the process the same way the top arrow does.
        function authFlowBack(){
          if (authSubmittingPosterApp || authCompletingProfile) return;
          const posterPanel = document.getElementById('auth-panel-poster-app');
          if (posterPanel && posterPanel.classList.contains('active')) {
            if (authPosterAppStageIdx > 0) { authPosterAppBack(); return; }
            authShowCompleteProfile();
            return;
          }
          authExitOnboarding();
        }
        async function applyGoogleProfileInfo(){
          // Disabled on purpose: the name and profile photo shown in the app must only ever come
          // from what the person explicitly sets in Edit Profile
          return;
        }

        const BOOT_TIMED_OUT = Symbol('boot-timed-out');
        function withBootBudget(promise, ms){
          return Promise.race([
            promise,
            new Promise(resolve => setTimeout(() => resolve(BOOT_TIMED_OUT), ms)),
          ]);
        }

        async function authEnterApp(){
          authClearOnboardingPending();
          authForgetPendingVerify();
          // The account's saved theme (appPrefs) only arrives after the data loads below, which is
          // after the loading skeleton is already on screen
          try {
            if (localStorage.getItem('stitchTheme') === 'dark') {
              document.body.classList.add('dark-mode');
              document.documentElement.classList.add('dark-mode');
              if (typeof applyThemeColorMeta === 'function') applyThemeColorMeta();
            }
          } catch (e) {}
          // Put the Home skeleton cover up FIRST, then drop the Get Started gate underneath it with no
          // fade, so the gate can never be seen dissolving or re-appearing between login and the feed
          window.__stitchInApp = true;
          try { if (typeof showAuthTransitionLoading === 'function') showAuthTransitionLoading('', '', true); } catch (e) {}
          const gate = document.getElementById('auth-gate');
          if (gate) { gate.classList.add('auth-hidden'); gate.classList.add('auth-gone'); }
          resetCachedAuthUser();
          // Belt-and-suspenders alongside the same call in authSignOut(): make sure no stale cached
          // feed/profile DOM from a previous session can survive into this login either
          if (typeof invalidateFeedAndProfileCaches === 'function') invalidateFeedAndProfileCaches();
          // Every fresh login should show the Home feed's loading state again (the shimmer skeleton,
          // or a cached snapshot if one's saved) while this session's own data comes in
          if (typeof remotePostsLoaded !== 'undefined') remotePostsLoaded = false;
          // Re-arm the initial-media hold (see preloadInitialFeedMedia in feed.js) for this fresh
          // session
          if (typeof feedInitialMediaPreloadDone !== 'undefined') feedInitialMediaPreloadDone = (window.__stitchFreshSignup === true);

          // Paint this account's last-known-good name/username/photo (see hydrateProfileFromCache in
          // profile.js) BEFORE the very first feed paint below, not after
          try {
            const sbBoot = getSupabaseClient();
            if (sbBoot) {
              const { data: bootSessionData } = await sbBoot.auth.getSession();
              const bootUserId = bootSessionData && bootSessionData.session && bootSessionData.session.user ? bootSessionData.session.user.id : null;
              if (bootUserId && typeof hydrateProfileFromCache === 'function') {
                hydrateProfileFromCache(bootUserId);
                if (typeof updateNavProfileIcon === 'function') updateNavProfileIcon();
              }
            }
          } catch (e) { /* profile-cache warm-up is a nicety, never worth blocking login over */ }

          // Build the real app shell right now instead of waiting on the data loads below
          await renderApp();
          const appShellEl = document.getElementById('app-shell');
          if (appShellEl) appShellEl.classList.add('boot-locked');

          // Always land on Home after logging in
          if (typeof currentTab !== 'undefined' && currentTab !== 0 && typeof switchTab === 'function') switchTab(0);
          // Covers the gap the two lines above don't: a returning login (appShellMounted already
          // true, so renderApp() no-op'd) where the person happened to already be sitting on tab 0
          if (typeof currentTab !== 'undefined' && currentTab === 0 && typeof renderFeed === 'function') renderFeed();
          // The app shell (nav/top bar) and the Home feed's shimmer skeleton are now on screen
          if (typeof hideAuthTransitionLoading === 'function') hideAuthTransitionLoading(true);
          // Fresh login/signup: the next time Classroom is opened this session, show the spin-up
          // animation once again
          if (typeof classroomNeedsLoadingAnimation !== 'undefined') classroomNeedsLoadingAnimation = true;

          if (typeof rollAIRobotPoseForNewLogin === 'function') rollAIRobotPoseForNewLogin();

          if (typeof preloadAppImageAssets === 'function') preloadAppImageAssets();

          // Fire-and-forget admin notice check.
          if (typeof checkAppNotice === 'function') checkAppNotice();
          if (typeof startAppNoticeLive === 'function') startAppNoticeLive();

          // Feed load chain split out of the big Promise.all so the feed paints as soon as its own
          // data is ready. Listings start fetching right away, in parallel.
          if (typeof loadOpportunitiesRemote === 'function') loadOpportunitiesRemote();
          if (typeof subscribeToOpportunitiesRealtime === 'function') subscribeToOpportunitiesRealtime();

          const remotePostsPrefetch = (typeof fetchRemotePostsRaw === 'function') ? fetchRemotePostsRaw() : null;
          const feedReadyLoads = ensureUserStateLoaded(true).then(() => Promise.all([
            loadCareerStartProfile(),
            loadRemotePosts(remotePostsPrefetch).then(() => loadPostInteractions()),
          ]));
          // Other people's glimpses (stories), fetched in parallel with posts
          const glimpsesReadyLoads = loadRemoteGlimpses().catch(() => false);
          // Fires once both the feed's own chain AND glimpses have resolved
          Promise.all([feedReadyLoads, glimpsesReadyLoads]).then(async () => {
            if (typeof currentTab !== 'undefined' && currentTab === 0 && typeof renderFeed === 'function') {
              // Hold the skeleton open a beat longer until the first screenful of media has actually
              // loaded
              if (window.__stitchFreshSignup !== true && typeof preloadInitialFeedMedia === 'function') await preloadInitialFeedMedia();
              renderFeed();
            }
          }).catch(() => {});

          const essentialLoads = getCachedAuthUser().then(() => Promise.all([
            loadCurrentUserRole().then(() => (typeof loadCreatorState === 'function' ? loadCreatorState() : null)),
            subscribeToUserNotifications(),
            loadUnreadNotificationsRemote(),
            feedReadyLoads,
            loadMyClasses(),
            loadCoursesRemote(),
            loadOpportunitiesRemote(),
            glimpsesReadyLoads,
            subscribeToIncomingMessages(),
            subscribeToPresence(),
            startLastActiveHeartbeat(),
            subscribeToIncomingCalls(),
            subscribeToIncomingLectureCalls(),
            subscribeToConnectionUpdates(),
            (typeof startConnectionsPolling === 'function' ? startConnectionsPolling() : null),
            subscribeToCoursesRealtime(),
            startCoursesPolling(),
            startOpportunitiesPolling(),
            subscribeToClassesRealtime(),
            subscribeToCollabMembership(),
            subscribeToFeedActivity(),
            (typeof startFeedPolling === 'function' ? startFeedPolling() : null),
            // Kick off the Discover people list right away instead of waiting for the person to open
            // Discover/the profile panel
            (typeof loadDiscoverPeople === 'function' ? loadDiscoverPeople() : Promise.resolve()),
            (typeof subscribeToDiscoverPeople === 'function' ? subscribeToDiscoverPeople() : null),
            (typeof startDiscoverPeoplePolling === 'function' ? startDiscoverPeoplePolling() : null),
          ])).catch(e => console.error(e));

          const result = await withBootBudget(essentialLoads, 2000);
          initPushNotifications();
          startMessagePolling();

          essentialLoads.then(async () => {
            // Not re-rendering Home here on purpose. feedReadyLoads already repaints it with real data.
            if (typeof currentTab !== 'undefined' && currentTab === 4 && typeof patchProfileHeaderInPlace === 'function') patchProfileHeaderInPlace();
          });

          if (typeof checkPendingChallengeLinkJoin === 'function') checkPendingChallengeLinkJoin();
          if (typeof checkPendingCollabLinkJoin === 'function') checkPendingCollabLinkJoin();
          if (typeof checkPendingMeetingLink === 'function') checkPendingMeetingLink();
          // Links that arrived before sign-in (the page reloaded and dropped the address-bar params)
          try {
            const raw = localStorage.getItem('stitch-pending-link');
            localStorage.removeItem('stitch-pending-link');
            const sv = raw ? JSON.parse(raw) : null;
            if (sv && sv.p && Date.now() - sv.t < 24 * 3600 * 1000) {
              const p = sv.p;
              if (p.post && !(window.__linkDone && window.__linkDone.post) && typeof openPostById === 'function') {
                (window.__linkDone = window.__linkDone || {}).post = true;
                openPostById(isNaN(Number(p.post)) ? p.post : Number(p.post));
              } else if (p.joinCollab && !window.location.search) history.replaceState(null, '', window.location.pathname + '?joinCollab=' + encodeURIComponent(p.joinCollab));
              else if (p.joinLecture && !window.location.search) history.replaceState(null, '', window.location.pathname + '?joinLecture=' + encodeURIComponent(p.joinLecture));
              else if (p.glimpse && !window.location.search) history.replaceState(null, '', window.location.pathname + '?glimpse=' + encodeURIComponent(p.glimpse));
              else if (p.u && !window.location.search) history.replaceState(null, '', window.location.pathname + '?u=' + encodeURIComponent(p.u));
              else if (p.joinClass && !window.location.search) history.replaceState(null, '', window.location.pathname + '?joinClass=' + encodeURIComponent(p.joinClass));
              else if (p.course && !window.location.search) history.replaceState(null, '', window.location.pathname + '?course=' + encodeURIComponent(p.course));
              else if (p.joinChallenge && !window.location.search) history.replaceState(null, '', window.location.pathname + '?joinChallenge=' + encodeURIComponent(p.joinChallenge));
              if (p.joinChallenge && typeof checkPendingChallengeLinkJoin === 'function') checkPendingChallengeLinkJoin();
              if (p.joinCollab && typeof checkPendingCollabLinkJoin === 'function') checkPendingCollabLinkJoin();
            }
          } catch (e) { /* best effort */ }
          if (typeof checkPendingLectureLinkJoin === 'function') checkPendingLectureLinkJoin();
          if (typeof checkPendingGlimpseLink === 'function') checkPendingGlimpseLink();
          if (typeof checkPendingClassLink === 'function') checkPendingClassLink();
          if (typeof checkPendingCourseLink === 'function') checkPendingCourseLink();
          if (typeof checkPendingProfileLink === 'function') checkPendingProfileLink();

          // The tab bar stays locked until the Home skeleton has fully finished loading and the real
          // feed is on screen
          if (result === BOOT_TIMED_OUT) {
            withBootBudget(essentialLoads, 15000).then(async () => {
              if (typeof currentTab !== 'undefined' && currentTab === 0 && typeof renderFeed === 'function') {
                if (typeof preloadInitialFeedMedia === 'function') await preloadInitialFeedMedia();
                renderFeed();
              }
              if (typeof currentTab !== 'undefined' && currentTab === 4 && typeof patchProfileHeaderInPlace === 'function') patchProfileHeaderInPlace();
              if (typeof updateNavProfileIcon === 'function') updateNavProfileIcon();
            });
          }
          // Last-resort safety net so a fully stalled connection can never trap someone on the
          // skeleton forever (the media preload's own hard timeout is 60s)
          setTimeout(() => { if (typeof unlockBootShell === 'function') unlockBootShell(); }, 70000);

          setTimeout(() => { if (!window.__msgBadgeSynced) { window.__msgBadgeSynced = true; try { refreshMessagingBadges(); } catch (e) {} } }, 20000);
          essentialLoads
            .then(() => applyGoogleProfileInfo())
            .then(() => {
              if (typeof updateNavProfileIcon === 'function') updateNavProfileIcon();
            })
            .then(() => Promise.all([
              syncPublicProfile(),
              loadIncomingConnectionRequests(),
              loadMyAcceptedIncomingRequests(),
              loadMyAcceptedOutgoingRequests(),
              refreshNetworkCount(),
              loadMyCollaborations(),
              reconcileUnreadMessages(),
              (typeof reconcileConvoOrder === 'function' ? reconcileConvoOrder() : Promise.resolve()),
            ]))
            .catch(() => {})
            .then(() => {
              window.__msgBadgeSynced = true;
              // Connections are loaded now: show any feed posts that were held back until then
              if (typeof feedRefreshForNetworkChange === 'function') feedRefreshForNetworkChange();
              refreshMessagingBadges();
              if (typeof refreshNotifBadge === 'function') refreshNotifBadge();
              if (typeof prefetchContactProfiles === 'function') prefetchContactProfiles().catch(e => console.error(e));
            })
            .catch(e => console.error(e));
        }

        let authOtpSendInFlight = false;
        async function authSendOtp(){
          await authAwaitPendingDiscard();
          const sb = getSupabaseClient();
          const err = document.getElementById('auth-verify-error');
          if (!sb) {
            if (err) { err.textContent = 'Sign-in backend is not configured yet.'; err.classList.add('show'); }
            return;
          }
          if (authOtpSendInFlight) return;
          authOtpSendInFlight = true;
          try {
            // This single Get Started panel is now the only entry point, so shouldCreateUser is always
            // true
            const { error } = await sb.auth.signInWithOtp({
              email: authPendingEmail,
              options: { shouldCreateUser: true }
            });
            if (error) {
              console.error('OTP send error:', error);
              const isRateLimit = /security purposes|only request this after|rate limit/i.test(error.message || '');
              if (isRateLimit) {
                if (err) {
                  err.textContent = 'A code was already sent recently -- check your inbox (and spam folder), or wait for the timer to request a new one.';
                  err.style.color = '#b45309';
                  err.classList.add('show');
                }
              } else {
                const msg = (error.message && error.message !== '{}') ? error.message : 'Could not send the code -- try again.';
                if (err) { err.textContent = msg; err.classList.add('show'); }
              }
            } else if (err) {
              err.classList.remove('show');
            }
          } catch (e) {
            if (err) { err.textContent = 'Could not send the code -- try again.'; err.classList.add('show'); }
          } finally {
            authOtpSendInFlight = false;
          }
        }
        // ---- OTP resend countdown + input handling ----
        function authResendCode(){
          for (let i = 0; i < 6; i++) { const el = document.getElementById('auth-otp-' + i); if (el) el.value = ''; }
          document.getElementById('auth-verify-error').classList.remove('show');
          const first = document.getElementById('auth-otp-0');
          if (first) first.focus();
          authSendOtp();
          authStartResendCountdown();
        }
        let authResendTimer = null;
        let authResendSecondsLeft = 0;
        const AUTH_RESEND_WAIT_SECONDS = 60; 
        function authStartResendCountdown(){
          authStopResendCountdown();
          authResendSecondsLeft = AUTH_RESEND_WAIT_SECONDS;
          authRenderResendCountdown();
          authResendTimer = setInterval(() => {
            authResendSecondsLeft -= 1;
            if (authResendSecondsLeft <= 0) { authStopResendCountdown(); return; }
            authRenderResendCountdown();
          }, 1000);
        }
        function authStopResendCountdown(){
          if (authResendTimer) { clearInterval(authResendTimer); authResendTimer = null; }
          authResendSecondsLeft = 0;
          const btn = document.getElementById('auth-resend-btn');
          const countdown = document.getElementById('auth-resend-countdown');
          if (btn) btn.classList.remove('hidden');
          if (countdown) countdown.classList.add('hidden');
        }
        function authRenderResendCountdown(){
          const btn = document.getElementById('auth-resend-btn');
          const countdown = document.getElementById('auth-resend-countdown');
          if (btn) btn.classList.add('hidden');
          if (countdown) {
            countdown.classList.remove('hidden');
            countdown.textContent = ' Resend in 0:' + String(authResendSecondsLeft).padStart(2, '0');
          }
        }
        // In-app number pad for the verify page: fills the six boxes without opening the phone keyboard
        // "Done" key (bottom-right of the number pad): same as the old Verify & Continue button
        function authKeypadDone(){
          if (typeof authSubmittingVerify !== 'undefined' && authSubmittingVerify) return;
          const f = document.querySelector('#auth-panel-verify form');
          if (f && f.requestSubmit) f.requestSubmit(); else if (f) authSubmitVerify({ preventDefault(){} });
        }
        function authKeypadPress(key){
          if (typeof authSubmittingVerify !== 'undefined' && authSubmittingVerify) return;
          const boxes = [0,1,2,3,4,5].map(i => document.getElementById('auth-otp-' + i));
          if (boxes.some(b => !b || b.disabled)) return;
          const err = document.getElementById('auth-verify-error');
          if (err) err.classList.remove('show');
          if (key === 'del') {
            let last = -1;
            boxes.forEach((b, i) => { if (b.value) last = i; });
            if (last >= 0) { boxes[last].value = ''; boxes[last].focus(); }
            return;
          }
          const next = boxes.findIndex(b => !b.value);
          if (next === -1) return;
          boxes[next].value = key;
          const after = boxes[Math.min(next + 1, 5)];
          if (after) after.focus();
        }
        // The on-screen number pad is for phones only. On a computer (wide screen + mouse) the six boxes
        // take the real keyboard, like before.
        function authApplyOtpInputMode(){
          let desk = false;
          try { desk = window.matchMedia('(min-width:700px) and (hover:hover) and (pointer:fine)').matches; } catch (e) {}
          for (let i = 0; i < 6; i++) {
            const el = document.getElementById('auth-otp-' + i);
            if (!el) continue;
            el.readOnly = !desk;
            el.setAttribute('inputmode', desk ? 'numeric' : 'none');
          }
        }
        authApplyOtpInputMode();
        window.addEventListener('resize', authApplyOtpInputMode);

        function authOtpInput(e, idx){
          const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 1);
          e.target.value = val;
          if (val && idx < 5) {
            const next = document.getElementById('auth-otp-' + (idx + 1));
            if (next) next.focus();
          }
        }
        function authOtpKeydown(e, idx){
          if (e.key === 'Backspace' && !e.target.value && idx > 0) {
            const prev = document.getElementById('auth-otp-' + (idx - 1));
            if (prev) { prev.value = ''; prev.focus(); }
          } else if (e.key === 'Enter' || e.key === 'Go') {
            e.preventDefault();
            const form = e.target.closest('form');
            if (form) { if (form.requestSubmit) form.requestSubmit(); else authSubmitVerify(e); }
          }
        }
        function authOtpPaste(e){
          const raw = (e.clipboardData || window.clipboardData).getData('text');
          const digits = raw.replace(/[^0-9]/g, '').slice(0, 6);
          if (!digits) return;
          e.preventDefault();
          for (let i = 0; i < 6; i++) {
            const el = document.getElementById('auth-otp-' + i);
            if (el) el.value = digits[i] || '';
          }
          const target = document.getElementById('auth-otp-' + Math.min(digits.length, 5));
          if (target) target.focus();
        }
        let appConfirmModalAction = null; 
        function openAppConfirmModal(title, message, confirmLabel, action, iconType, cancelLabel){
          appConfirmModalAction = typeof action === 'function' ? action : null;
          // Icon in the red circle: sign-out gets the logout icon, everything else the trash can.
          const iconEl = document.getElementById('appConfirmModalIcon');
          if (iconEl) {
            const kind = iconType || (/sign\s*out|log\s*out/i.test(confirmLabel || '') ? 'logout' : 'trash');
            iconEl.innerHTML = Icon(kind, 'w-6 h-6');
          }
          const modal = document.getElementById('appConfirmModal');
          const titleEl = document.getElementById('appConfirmModalTitle');
          const messageEl = document.getElementById('appConfirmModalMessage');
          const btnEl = document.getElementById('appConfirmModalConfirmBtn');
          if (titleEl) titleEl.textContent = title || 'Are you sure?';
          if (messageEl) messageEl.textContent = message || '';
          if (btnEl) btnEl.textContent = confirmLabel || 'Confirm';
          const cancelBtnEl = document.getElementById('appConfirmModalCancelBtn');
          if (cancelBtnEl) cancelBtnEl.textContent = cancelLabel || 'Cancel';
          if (modal) modal.classList.remove('hidden');
          if (typeof pushModalBackHandler === 'function') pushModalBackHandler(fromPopState => closeAppConfirmModal(fromPopState));
        }
        function closeAppConfirmModal(fromPopState){
          const modal = document.getElementById('appConfirmModal');
          if (modal) modal.classList.add('hidden');
          if (typeof popModalBackHandler === 'function') popModalBackHandler(fromPopState);
        }
        function confirmAppConfirmYes(){
          closeAppConfirmModal();
          const action = appConfirmModalAction;
          appConfirmModalAction = null;
          if (action) action();
        }

        // Alerts that only need an OK show as a dismissible top banner. On desktop, pop-ups sit in the
        // middle of the content area, between the left menu and right panel.
        function placeToastInContent(el){
          if (!el) return;
          // Several top notices at once stack neatly instead of sitting on top of each other
          try {
            el.classList.add('app-toast');
            let off = 0;
            document.querySelectorAll('.app-toast').forEach(o => { if (o !== el && o.isConnected) off = Math.max(off, o.getBoundingClientRect().bottom); });
            if (off > 0) el.style.top = Math.round(off + 8) + 'px';
          } catch (e) {}
          const place = () => {
            if (!el.isConnected) { window.removeEventListener('resize', place); if (el.__toastRO) { try { el.__toastRO.disconnect(); } catch (e) {} } return; }
            if (window.innerWidth < 1100) { el.style.left = ''; el.style.width = 'calc(100% - 24px)'; el.style.maxWidth = 'none'; return; }   // phones: stretch to the side margins
            const nav = document.getElementById('desktop-nav');
            const rp = document.getElementById('desktop-right-panel');
            let l = 0, r = window.innerWidth;
            try {
              if (nav) { const b = nav.getBoundingClientRect(); if (b.width > 0 && b.right < window.innerWidth) l = Math.max(l, b.right); }
              if (rp) { const b = rp.getBoundingClientRect(); if (b.width > 0 && b.left > l) r = Math.min(r, b.left); }
            } catch (e) {}
            const w = Math.max(0, r - l);
            el.style.left = Math.round(l + w / 2) + 'px';
            el.style.width = 'max-content';
            el.style.maxWidth = Math.max(240, Math.min(560, Math.round(w * 0.8))) + 'px';
          };
          place();
          window.addEventListener('resize', place);
          try {
            if (typeof ResizeObserver !== 'undefined') {
              const ro = new ResizeObserver(place); el.__toastRO = ro;
              ['desktop-nav', 'desktop-right-panel'].forEach(id => { const n = document.getElementById(id); if (n) ro.observe(n); });
            }
          } catch (e) {}
        }
        function openAppAlertModal(message, title, onClose){
          const el = document.createElement('div');
          el.className = 'fixed left-1/2 -translate-x-1/2 z-50 bg-white rounded-2xl shadow-lg px-4 py-3 flex items-start gap-3';
          el.style.cssText = 'top:calc(env(safe-area-inset-top, 12px) + 12px); width:max-content; min-width:min(220px, calc(100% - 32px)); max-width:min(480px, calc(100% - 32px)); box-shadow:0 10px 30px rgba(0,0,0,.18);';
          const hasTitle = !!(title && title.trim());
          el.innerHTML = `
            <div class="min-w-0 flex-1 text-center">
              ${hasTitle ? `<div class="text-sm text-[${NAVY}]">${escapeHtml(title)}</div>` : ''}
              <div class="${hasTitle ? 'text-xs text-gray-500' : `text-sm text-[${NAVY}]`}">${escapeHtml(message || '')}</div>
            </div>`;
          document.body.appendChild(el);
          placeToastInContent(el);
          let dismissed = false;
          const dismiss = () => {
            if (dismissed) return;
            dismissed = true;
            el.remove();
            if (typeof onClose === 'function') onClose();
          };
          el.style.cursor = 'pointer';
          el.addEventListener('click', dismiss);   // tap anywhere on the notice to close it
          enableSwipeDismiss(el, dismiss, 'translateX(-50%)');
          setTimeout(dismiss, 6000);
        }

        // Shared full-screen cover for the Sign Out and Delete Account transitions
        function authTransitionLoadingHTML(text, iconName){
          return `
            <div style="position:relative;width:84px;height:84px;">
              <div style="position:absolute;inset:0;border-radius:9999px;background:conic-gradient(from 90deg, ${NAVY}, ${ROYAL} 45%, rgba(10,37,64,0.12) 45%, rgba(10,37,64,0.12) 100%);-webkit-mask:radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px));mask:radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px));animation:classroom-spin 0.9s linear infinite;"></div>
              <div style="position:absolute;inset:10px;background:#ffffff;border-radius:9999px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(10,37,64,0.18);">
                ${gradIcon(Icon(iconName || 'user','w-8 h-8'))}
              </div>
            </div>
            <div class="mt-4 text-sm font-semibold text-gray-500 font-display" id="auth-transition-loading-text">${text}</div>`;
        }
        // Both Sign Out and Delete Account keep this cover up for at least this long once shown,
        // even if the underlying work (or the #auth-gate fade it's covering) finishes sooner
        const AUTH_TRANSITION_MIN_MS = 2000;
        let authTransitionShownAt = 0;
        let authTransitionDotTimer = null;
        function showAuthTransitionLoading(text, iconName, skeletonMode){
          const el = document.getElementById('auth-transition-loading');
          if (!el) return;
          authTransitionShownAt = Date.now();
          el.classList.toggle('skeleton-mode', !!skeletonMode);
          // 'plain' = same full-screen cover, but empty: a blank white (or dark) page with no
          // skeleton
          el.classList.toggle('plain-mode', skeletonMode === 'plain');
          if (!skeletonMode) el.classList.remove('skel-desktop-mode');
          if (skeletonMode) {
            // This skeleton can show before authEnterApp() applies the saved theme, so it used to
            // flash white first and turn dark later.
            try {
              if (localStorage.getItem('stitchTheme') === 'dark') {
                document.body.classList.add('dark-mode');
                document.documentElement.classList.add('dark-mode');
                if (typeof applyThemeColorMeta === 'function') applyThemeColorMeta();
              }
            } catch (e) {}
            if (authTransitionDotTimer) { clearInterval(authTransitionDotTimer); authTransitionDotTimer = null; }
            const desk = skeletonMode !== 'plain' && typeof isDesktopLayout === 'function' && isDesktopLayout();
            el.classList.toggle('skel-desktop-mode', desk);
            el.innerHTML = skeletonMode === 'plain' ? '' : (desk ? desktopShellSkeletonHTML() : feedSkeletonHTML());
            el.classList.remove('hidden');
            return;
          }
          el.innerHTML = authTransitionLoadingHTML(text, iconName);
          el.classList.remove('hidden');
          if (authTransitionDotTimer) clearInterval(authTransitionDotTimer);
          let dots = 0;
          authTransitionDotTimer = setInterval(() => {
            const txtEl = document.getElementById('auth-transition-loading-text');
            if (!txtEl) { clearInterval(authTransitionDotTimer); authTransitionDotTimer = null; return; }
            dots = (dots + 1) % 4;
            txtEl.textContent = text + '.'.repeat(dots);
          }, 350);
        }
        // `immediate` skips the AUTH_TRANSITION_MIN_MS floor entirely
        function hideAuthTransitionLoading(immediate){
          if (immediate) {
            if (authTransitionDotTimer) { clearInterval(authTransitionDotTimer); authTransitionDotTimer = null; }
            const el = document.getElementById('auth-transition-loading');
            if (el) { el.classList.add('hidden'); el.classList.remove('skeleton-mode'); el.classList.remove('plain-mode'); el.classList.remove('skel-desktop-mode'); }
            return;
          }
          const elapsed = Date.now() - authTransitionShownAt;
          const remaining = AUTH_TRANSITION_MIN_MS - elapsed;
          if (remaining > 0) { setTimeout(hideAuthTransitionLoading, remaining); return; }
          if (authTransitionDotTimer) { clearInterval(authTransitionDotTimer); authTransitionDotTimer = null; }
          const el = document.getElementById('auth-transition-loading');
          if (el) { el.classList.add('hidden'); el.classList.remove('skeleton-mode'); el.classList.remove('plain-mode'); el.classList.remove('skel-desktop-mode'); }
        }

        function authSignOut(){
          openAppConfirmModal('Sign out of Stitch?', "You'll need to log back in to access your account.", 'Sign Out', function(){
            overlayHistoryPushed = false;
            window.__stitchFreshSignup = false;
            showAuthTransitionLoading('Signing out', 'logout');
            // Persist any unsaved state and end the Supabase session in the background
            (async () => {
              const sb = getSupabaseClient();
              if (typeof saveUserStateNow === 'function') { try { await saveUserStateNow(); } catch (e) {} }
              if (sb) { sb.auth.signOut().catch(() => {}); }
            })();
            resetCachedAuthUser();
            // Reset every in-memory glimpse/story global back to a clean slate
            if (typeof stories !== 'undefined') stories = [{ id:0, name:'Glimpse', icon:'person', bg:'', mine:true }];
            if (typeof myGlimpses !== 'undefined') myGlimpses = [];
            if (typeof myGlimpsesViewed !== 'undefined') myGlimpsesViewed = false;
            if (typeof remoteGlimpsesLoaded !== 'undefined') remoteGlimpsesLoaded = false;
            if (typeof closeMyGlimpseMenu === 'function') closeMyGlimpseMenu();
            if (typeof currentStoryId !== 'undefined') currentStoryId = null;
            if (typeof currentItemIndex !== 'undefined') currentItemIndex = 0;
            if (typeof viewedGlimpsesThisSession !== 'undefined') viewedGlimpsesThisSession.clear();
            if (typeof resetGlimpseSeenServer === 'function') resetGlimpseSeenServer();
            // Belt-and-suspenders alongside invalidateFeedAndProfileCaches below: a signed-out
            // account's cached feed snapshot (used to show something instantly on a slow reconnect --
            if (typeof clearAllFeedCaches === 'function') clearAllFeedCaches();
            if (typeof clearAllProfileCaches === 'function') clearAllProfileCaches();
            // A cached-but-detached Home feed or Profile screen node (see switchTab in core.js) still
            // has this account's posts baked into its DOM. Without clearing it here, that node could
            if (typeof invalidateFeedAndProfileCaches === 'function') invalidateFeedAndProfileCaches();
            if (typeof careerStartProfile !== 'undefined') careerStartProfile = null;
            // Show the login screen (full-screen, on top of everything) BEFORE closing the settings
            // overlay
            window.__stitchInApp = false;
            authShowLogin();
            const gate = document.getElementById('auth-gate');
            if (gate) { gate.classList.remove('auth-gone'); gate.classList.remove('auth-hidden'); }
            closeOverlay();
            // Reset the tab underneath the (now-covering) login screen back to Home
            if (typeof switchTab === 'function') switchTab(0);
            // #auth-gate is now fully opaque and mid fade-in
            setTimeout(hideAuthTransitionLoading, 220);
          });
        }
        function authDeleteAccountNow(){
          (function(){
              overlayHistoryPushed = false;
              // Same cover as Sign Out
              showAuthTransitionLoading('Deleting account', 'trash');
              (async () => {
                let deletingUser = null;
                try { deletingUser = await getCachedAuthUser(); } catch (e) {}
                const result = (typeof deleteAccountRemote === 'function')
                  ? await deleteAccountRemote()
                  : { ok: false, error: 'Account deletion is not set up yet.' };
                if (!result.ok) {
                  hideAuthTransitionLoading();
                  openAppAlertModal(
                    result.error || "We couldn't delete your account. Please try again.",
                    "Couldn't delete account"
                  );
                  return;
                }
                // From here on this identity can only come back through full sign-up/onboarding.
                authAddTombstone(deletingUser);
                authClearOnboardedFlags(deletingUser);
                try {
                  const sb = getSupabaseClient();
                  if (sb) await sb.auth.signOut().catch(() => {});
                  if (window.storage) await window.storage.delete('gameProgress', false);
                } catch (e) {  }
                // Account is gone
                if (typeof clearAllFeedCaches === 'function') clearAllFeedCaches();
                if (typeof clearAllProfileCaches === 'function') clearAllProfileCaches();
                // Same minimum-visible-time rule as hideAuthTransitionLoading above
                const elapsed = Date.now() - authTransitionShownAt;
                const remaining = AUTH_TRANSITION_MIN_MS - elapsed;
                setTimeout(() => location.reload(), Math.max(0, remaining));
              })();
          })();
        }

        // Delete-account confirm sheet: Cancel or Delete
        function authDeleteAccount(){
          closeDeleteAccountSheet();
          // Same sheet as "Sign out": same title style, position and pill buttons
          openAppConfirmModal('Delete account?', 'Your profile, posts, chats and course progress will be permanently removed. This can\u2019t be undone.', 'Delete', function(){ authDeleteAccountNow(); }, 'trash');
        }
        function deleteAccountSheetInput(v){
          const ok = String(v || '').trim().toUpperCase() === 'DELETE';
          const btn = document.getElementById('delete-account-confirm');
          if (btn) { btn.style.background = ok ? '#dc2626' : '#fca5a5'; btn.dataset.ok = ok ? '1' : '0'; }
        }
        function deleteAccountSheetConfirm(){
          const btn = document.getElementById('delete-account-confirm');
          if (!btn) return;
          closeDeleteAccountSheet();
          authDeleteAccountNow();
        }
        function closeDeleteAccountSheet(){
          const el = document.getElementById('delete-account-sheet');
          if (el) el.remove();
        }
        async function authSubmitLogin(e){
          if (e) e.preventDefault();
          const email = document.getElementById('auth-li-email').value.trim();
          const err = document.getElementById('auth-login-error');

          if (!email) { err.textContent = 'Enter your email to continue.'; err.classList.add('show'); return; }
          if (!isValidEmail(email)) { err.textContent = 'Enter a valid email address (e.g. name@example.com).'; err.classList.add('show'); return; }

          const sb = getSupabaseClient();
          if (!sb) { err.textContent = 'Sign-in backend is not configured yet.'; err.classList.add('show'); return; }
          err.classList.remove('show');
          // No password: authShowVerify (below) sends the one-time email code itself (see
          // authSendOtp), and the code is the entire authentication
          authShowVerify(email);
        }
        let authSubmittingVerify = false;
        async function authSubmitVerify(e){
          if (e) e.preventDefault();
          if (authSubmittingVerify) return;
          const entered = [0,1,2,3,4,5].map(i => {
            const el = document.getElementById('auth-otp-' + i);
            return el ? el.value : '';
          }).join('');
          const err = document.getElementById('auth-verify-error');
          if (entered.length < 6) {
            err.textContent = 'Enter the full 6-digit code.';
            err.classList.add('show');
            return;
          }
          const sb = getSupabaseClient();
          if (!sb) { err.textContent = 'Sign-in backend is not configured yet.'; err.classList.add('show'); return; }
          err.classList.remove('show');
          authSubmittingVerify = true;
          // No full-screen "Verifying" cover here anymore. Stay on the same panel with the code
          // boxes disabled and an inline "Verifying..." on the button.
          for (let i = 0; i < 6; i++) { const el = document.getElementById('auth-otp-' + i); if (el) el.disabled = true; }
          const verifyBtn = document.querySelector('#auth-panel-verify .auth-cta');
          const verifyBtnOriginalText = verifyBtn ? verifyBtn.textContent : '';
          if (verifyBtn) { verifyBtn.disabled = true; verifyBtn.style.opacity = '0.6'; verifyBtn.textContent = 'Verifying...'; }
          const keypadDone = document.querySelector('#auth-keypad .auth-keypad-done');
          if (keypadDone) { keypadDone.disabled = true; keypadDone.style.opacity = '0.5'; }
          try {
            let error;
            ({ error } = await sb.auth.verifyOtp({
              email: authPendingEmail,
              token: entered,
              type: 'email'
            }));
            if (error) {
              console.error('OTP verify error:', error);
              err.textContent = (error.message && error.message !== '{}') ? error.message : 'That code is incorrect or expired.';
              err.classList.add('show');
              return;
            }
            authMarkDeviceTrusted(authPendingEmail);
            // A code was just accepted for this email -- check whether it already has a Stitch profile
            let needsProfileSetup = await authCheckNeedsProfileSetup();
            if (needsProfileSetup === null) {
              await authAbortUnverifiedSignIn();
            } else if (needsProfileSetup) {
              authShowCompleteProfile();
            } else {
              await authEnterApp();
            }
          } finally {
            authSubmittingVerify = false;
            for (let i = 0; i < 6; i++) { const el = document.getElementById('auth-otp-' + i); if (el) el.disabled = false; }
            if (verifyBtn) { verifyBtn.disabled = false; verifyBtn.style.opacity = ''; verifyBtn.textContent = verifyBtnOriginalText || 'Verify & Continue'; }
            if (keypadDone) { keypadDone.disabled = false; keypadDone.style.opacity = ''; }
          }
        }
        // Decides whether the signed-in account still has to go through sign-up/onboarding
        async function authCheckNeedsProfileSetup(){
          const sb = getSupabaseClient();
          if (!sb) return null;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              resetCachedAuthUser();
              const user = await getCachedAuthUser();
              if (user) {
                const { data, error } = await sb.from(PUBLIC_PROFILES_TABLE).select('user_id, username, deleted').eq('user_id', user.id).limit(1);
                if (!error) {
                  const row = (Array.isArray(data) && data.length > 0) ? data[0] : null;
                  // A trigger (create_public_profile_for_new_user) inserts a BLANK row the instant any auth
                  // user is created, so a row merely EXISTING proves nothing
                  const hasCompletedProfile = !!(row && row.deleted !== true && typeof row.username === 'string' && row.username.trim() !== '');
                  if (!hasCompletedProfile) {
                    // Brand-new / re-created account: wipe any leftover "onboarded" flags for this id.
                    authClearOnboardedFlags(user);
                    return true;
                  }
                  return false;
                }
              }
            } catch (e) { /* retry below */ }
            await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
          }
          return null;
        }
        // Couldn't confirm whether this account is set up: never guess "returning user"
        async function authAbortUnverifiedSignIn(){
          try { const sb = getSupabaseClient(); if (sb) await sb.auth.signOut().catch(() => {}); } catch (e) {}
          try { resetCachedAuthUser(); } catch (e) {}
          try { hideAuthTransitionLoading(); } catch (e) {}
          try { authShowLogin(); } catch (e) {}
          try { openAppAlertModal("We couldn't verify your account. Check your connection and try signing in again.", "Sign-in failed"); } catch (e) {}
        }
        // ---- Deleted-account tombstones ----
        function authReadTombstones(){
          try { const v = JSON.parse(localStorage.getItem('stitchDeletedAccounts') || '{}'); return { ids: v.ids || [], emails: v.emails || [] }; } catch (e) { return { ids: [], emails: [] }; }
        }
        function authWriteTombstones(t){ try { localStorage.setItem('stitchDeletedAccounts', JSON.stringify(t)); } catch (e) {} }
        function authAddTombstone(user){
          if (!user) return;
          const t = authReadTombstones();
          if (user.id && t.ids.indexOf(user.id) < 0) t.ids.push(user.id);
          const em = (user.email || '').toLowerCase();
          if (em && t.emails.indexOf(em) < 0) t.emails.push(em);
          authWriteTombstones(t);
        }
        function authIsDeletedTombstoned(user){
          if (!user) return false;
          const t = authReadTombstones();
          const em = (user.email || '').toLowerCase();
          return (user.id && t.ids.indexOf(user.id) >= 0) || (em && t.emails.indexOf(em) >= 0);
        }
        function authClearTombstone(user){
          if (!user) return;
          const t = authReadTombstones();
          const em = (user.email || '').toLowerCase();
          t.ids = t.ids.filter(i => i !== user.id);
          t.emails = t.emails.filter(e => e !== em);
          authWriteTombstones(t);
        }
        function authClearOnboardedFlags(user){
          try { if (user && user.id) localStorage.removeItem('stitchOnboarded:' + user.id); } catch (e) {}
          try {
            const sb = getSupabaseClient();
            if (sb && user && user.user_metadata && user.user_metadata.stitch_onboarded) sb.auth.updateUser({ data: { stitch_onboarded: false } }).catch(() => {});
          } catch (e) {}
        }
        function authIsOnboardedFlagSet(user){
          try {
            if (user && user.user_metadata && user.user_metadata.stitch_onboarded) return true;
            if (user && user.id && localStorage.getItem('stitchOnboarded:' + user.id) === '1') return true;
          } catch (e) {}
          return false;
        }
        // Records (on the account and on this device) that onboarding is finished, so signing back
        // in later never shows it again
        async function authMarkOnboarded(userArg){
          try {
            const sb = getSupabaseClient();
            const user = userArg || (sb ? await getCachedAuthUser() : null);
            if (!user || !user.id) return;
            // A deleted account can't be marked onboarded again until it completes sign-up.
            if (authIsDeletedTombstoned(user) && !authProfileJustCompleted) return;
            authClearTombstone(user);
            try { localStorage.setItem('stitchOnboarded:' + user.id, '1'); } catch (e) {}
            if (sb && !(user.user_metadata && user.user_metadata.stitch_onboarded)) {
              await sb.auth.updateUser({ data: { stitch_onboarded: true } });
            }
          } catch (e) { /* best-effort; the localStorage flag and the profile row still cover it */ }
        }
        let authCompletingProfile = false;
        let authProfileJustCompleted = false;
        // Submits the one-time "tell us about yourself" step for a new account, then shows the same
        // loading cover as elsewhere. The Continue button on "Almost there" locks and shows a spinner.
        function authSetCpBusy(on){
          const b = document.getElementById('auth-cp-submit');
          if (!b) return;
          const backPill = document.getElementById('auth-cp-back');
          if (backPill) backPill.disabled = !!on;
          if (on) {
            b.disabled = true;
            b.classList.add('auth-cta-busy');
            b.innerHTML = '<span class="auth-cta-spinner" aria-hidden="true"></span><span>Let\'s gooo!!!</span>';
          } else {
            b.disabled = false;
            b.classList.remove('auth-cta-busy');
            b.textContent = 'Finish';
          }
        }
        async function authSubmitCompleteProfile(e){
          if (e) e.preventDefault();
          if (authCompletingProfile) return;
          const fname = document.getElementById('auth-cp-fname').value.trim();
          const lname = document.getElementById('auth-cp-lname').value.trim();
          const username = document.getElementById('auth-cp-username').value.trim();
          const err = document.getElementById('auth-complete-profile-error');
          if (!fname || !lname || !username) {
            err.textContent = 'Please fill in all fields.';
            err.classList.add('show');
            return;
          }
          if (!isValidName(fname) || !isValidName(lname)) {
            err.textContent = 'Names can only contain letters, spaces, hyphens, and apostrophes.';
            err.classList.add('show');
            return;
          }
          if (isReservedStitchIdentity(fname) || isReservedStitchIdentity(lname)) {
            err.textContent = '"Stitch" is reserved and can\'t be used as your name.';
            err.classList.add('show');
            return;
          }
          if (isReservedStitchIdentity(username)) {
            err.textContent = '"Stitch" is reserved and can\'t be used as your username.';
            err.classList.add('show');
            return;
          }
          if (USERNAME_INVALID_RE.test(username)) {
            err.textContent = 'Usernames can only contain letters, numbers, periods, and underscores.';
            err.classList.add('show');
            return;
          }
          authCompletingProfile = true;
          authSetCpBusy(true);
          let taken;
          try { taken = await isUsernameTaken(username); }
          catch (e2) { authCompletingProfile = false; authSetCpBusy(false); throw e2; }
          authCompletingProfile = false;
          if (taken) {
            authSetCpBusy(false);
            err.textContent = 'That username is already taken. Please choose another.';
            err.classList.add('show');
            return;
          }
          err.classList.remove('show');
          const fullName = `${fname} ${lname}`.trim();
          if (typeof profileData !== 'undefined') {
            profileData.name = fullName;
            profileData.username = username;
          }
          // No more questions after the name and username: the account is created right here
          if (typeof resetPosterAppDraft === 'function') resetPosterAppDraft();
          posterAppDraft.intent = 'explore';
          posterAppDraft.interests = [];
          authIntentPicks = new Set();
          authPendingPhotoBlob = null;
          authSubmittingPosterApp = true;
          const committed = await authCommitNewAccount();
          if (!committed) {
            authSubmittingPosterApp = false;
            authSetCpBusy(false);
            err.textContent = "We couldn't finish setting up your account. Check your connection and try again.";
            err.classList.add('show');
            return;
          }
          try { if (typeof submitPosterApplication === 'function') await submitPosterApplication(); } catch (e3) {}
          authSubmittingPosterApp = false;
          await authEnterApp();
          hideAuthTransitionLoading(true);
        }
        // ---- Terms screen (shown from the Get Started panel) ----
        function authShowTerms(){
          const m = document.getElementById('auth-terms-modal');
          // Same text as the in-app Terms of Service (settings.js)
          const body = document.getElementById('auth-terms-body');
          if (body && typeof legalTermsSections === 'function') body.innerHTML = legalDateLineHTML('plain') + legalRenderHTML(legalTermsSections(), 'plain');
          if (m) { m.style.display = 'block'; m.classList.remove('hidden'); }
          setStitchPageTitle('Terms of Service');
        }
        function authHideTerms(){
          const m = document.getElementById('auth-terms-modal');
          if (m) { m.style.display = 'none'; m.classList.add('hidden'); }
          resetStitchPageTitle();
        }
        const FOOTER_INFO_CONTENT = {
          privacy: {
            title: 'Privacy Policy',
            // Rendered from the same source as the in-app Privacy Policy (settings.js)
            get html(){
              return (typeof legalPrivacySections === 'function')
                ? legalDateLineHTML('plain') + legalRenderHTML(legalPrivacySections(), 'plain')
                : '<p>Questions about privacy? Email support.stitch.io@gmail.com.</p>';
            }
          },
          help: {
            title: 'Help Center',
            html: `
              <h3 style="font-weight:700;padding-top:4px;">Getting started</h3>
              <p>Register with your email, join or create a space with a space code, and you're set -- upload a document to generate notes, flashcards, and practice questions from it automatically.</p>
              <h3 style="font-weight:700;padding-top:4px;">Common questions</h3>
              <p><strong>How do study groups work?</strong> Anyone in a space can start or lead a group -- no admin approval needed.</p>
              <p><strong>What are the usage limits?</strong> Every account gets 30 Stitch Bot prompts a day (up to 150 a week and 500 a month). Free accounts also get 3 mock tests, 3 sets of AI-marked written answers and 2 Challenge Arena games a week, and 3 uploads turned into questions a month. Stitch Pro (GHS 5 a day, GHS 20 a week or GHS 50 a month) gives about ten times more of those.</p>
              <p><strong>My upload didn't generate anything.</strong> This usually means it looked like a duplicate of something you already uploaded. Try again with the original file.</p>
              <p>Didn't find your answer? Reach out below and we'll help directly.</p>
            `
          },
          contact: {
            title: 'Contact Us',
            html: `
              <p>Have a question, feedback, or just want to say hi? We'd love to hear from you.</p>
              <p style="font-size:15px;font-weight:700;color:#111827;margin-top:10px;">support.stitch.io@gmail.com</p>
              <p>We read every message and typically reply within 24 hours. For account-specific issues, include the email address on your Stitch account so we can look you up quickly.</p>
            `
          },
          report: {
            title: 'Report an Issue',
            html: `
              <p>Run into a bug, broken feature, or something that just doesn't look right? Let us know and we'll take a look.</p>
              <p style="font-size:15px;font-weight:700;color:#111827;margin-top:10px;">support.stitch.io@gmail.com</p>
              <p>To help us fix it fast, include: what you were trying to do, what happened instead, and the device/browser you're using. Screenshots help a lot too.</p>
              <p>If it's an urgent safety or abuse concern involving another user, mention that clearly in your subject line so we can prioritize it.</p>
            `
          }
        };
        // ---- Landing page footer info + splash screen ----
        function openFooterInfo(kind){
          const entry = FOOTER_INFO_CONTENT[kind];
          if (!entry) return;
          const titleEl = document.getElementById('footer-info-title');
          const bodyEl = document.getElementById('footer-info-body');
          if (titleEl) titleEl.textContent = entry.title;
          if (bodyEl) bodyEl.innerHTML = entry.html;
          const m = document.getElementById('footer-info-modal');
          if (m) { m.style.display = 'block'; m.classList.remove('hidden'); m.scrollTop = 0; }
          setStitchPageTitle(entry.title);
        }
        function closeFooterInfo(){
          const m = document.getElementById('footer-info-modal');
          if (m) { m.style.display = 'none'; m.classList.add('hidden'); }
          resetStitchPageTitle();
        }
        async function authContinueWithGoogle(){
          await authAwaitPendingDiscard();
          const sb = getSupabaseClient();
          if (!sb) {
            openAppAlertModal('Sign-in is not available right now. Please try again in a moment.');
            return;
          }
          try {
            const { error } = await sb.auth.signInWithOAuth({
              provider: 'google',
              options: {
                // Strip any #hash so the provider's token hash lands on a clean URL.
                redirectTo: window.location.href.split('#')[0],
                // Explicit, minimal scopes: just enough to create the account (name, email, profile photo)
                scopes: 'email profile'
              }
            });
            if (error) openAppAlertModal(error.message || 'Could not start Google sign-in.');
          } catch (e) {
            openAppAlertModal("Couldn't start Google sign-in. Please try again in a moment.");
          }
        }

        async function authContinueWithApple(){
          await authAwaitPendingDiscard();
          const sb = getSupabaseClient();
          if (!sb) {
            openAppAlertModal('Sign-in is not available right now. Please try again in a moment.');
            return;
          }
          try {
            const { error } = await sb.auth.signInWithOAuth({
              provider: 'apple',
              options: {
                // Strip any #hash so the provider's token hash lands on a clean URL.
                redirectTo: window.location.href.split('#')[0],
                // Apple only ever grants name/email on the FIRST authorization, and only if these scopes
                // are requested up front
                scopes: 'email name'
              }
            });
            if (error) openAppAlertModal(error.message || 'Could not start Apple sign-in.');
          } catch (e) {
            openAppAlertModal("Couldn't start Apple sign-in. Please try again in a moment.");
          }
        }

        async function restoreSessionIfSignedIn(){
          try { return await restoreSessionIfSignedInInner(); }
          finally {
            if (window.__stitchInstalledBoot) {
              // Whatever happened, the early cover and hidden pages must not stay stuck
              try { hideAuthTransitionLoading(true); } catch (e) {}
              document.documentElement.classList.remove('installed-boot');
            }
          }
        }
        async function restoreSessionIfSignedInInner(){
          const sb = getSupabaseClient();
          // Prefer the flag index.html captured before supabase-js could strip the hash from the URL
          // (see the oauth-returning script in <head>)
          const freshOAuthRedirect = window.__stitchFreshOAuthReturn === true || /access_token|provider_token/.test(window.location.hash || '');
          if (!sb) {
            // Supabase's SDK failed to load (blocked CDN, offline, ad blocker, etc)
            if (freshOAuthRedirect) hideAuthTransitionLoading();
            document.documentElement.classList.remove('oauth-returning');
            if (freshOAuthRedirect && typeof authShowLogin === 'function') authShowLogin();
            return;
          }
          // Google/Apple OAuth redirects back to this same URL, which is a fresh page load
          if (freshOAuthRedirect) {
            window.__stitchAuthRouted = true;
            // No white "Signing you in" cover anymore. A first sign-up goes to the profile screen,
            // a returning account gets the real app.
            const landing = document.getElementById('landing-page');
            if (landing) landing.classList.add('landing-hidden');
          }
          try {
            const { data } = await sb.auth.getSession();
            const session = data && data.session;
            if (!session) { if (freshOAuthRedirect) hideAuthTransitionLoading(); return; }
            const email = session.user && session.user.email;
            // authEnterApp() hides this cover itself the moment the app shell + Home feed skeleton are
            // painted (see hideAuthTransitionLoading(true) inside it)
            if (!email) { if (freshOAuthRedirect) showAuthTransitionLoading('Signing you in', 'user', true); await authEnterApp(); if (freshOAuthRedirect) hideAuthTransitionLoading(true); return; }
            if (freshOAuthRedirect) {
              // Google/Apple already proved who this is
              const needsProfileSetup = await authCheckNeedsProfileSetup();
              if (needsProfileSetup === null) { await authAbortUnverifiedSignIn(); return; }
              // Brand-new sign-up: the "Almost there" profile screen shows with no cover and no skeleton
              if (needsProfileSetup) {
                if (!window.__stitchOAuthShownProfile) authShowCompleteProfile();
                hideAuthTransitionLoading(true);
                return;
              }
              if (window.__stitchOAuthShownProfile) { window.__stitchOAuthShownProfile = false; }
              // Existing account signing in
              showAuthTransitionLoading('Signing you in', 'user', true);
              // authEnterApp() does the actual feed/data loading, but now hides this "Signing you in"
              // cover itself as soon as the app shell + Home feed skeleton are painted (see
              // hideAuthTransitionLoading(true) inside it)
              await authEnterApp();
              hideAuthTransitionLoading(true);
              return;
            }
            if (typeof isInstalledApp === 'function' && isInstalledApp()) {
              // Installed app: stay signed in until the person signs out or uninstalls
              let needs = null;
              try { needs = await authCheckNeedsProfileSetup(); } catch (e) {}
              if (needs === true) { authShowCompleteProfile(); return; }
              let known = false;
              try { known = localStorage.getItem('stitchOnboarded:' + session.user.id) === '1'; } catch (e) {}
              if (needs === false || known) { await authEnterApp(); return; }
            }
            await sb.auth.signOut().catch(() => {});
            authShowLogin();
          } catch (e) { if (freshOAuthRedirect) hideAuthTransitionLoading(); }
          finally {
            // #landing-page already carries .landing-hidden by now
            document.documentElement.classList.remove('oauth-returning');
          }
        }

        function dismissSplash(instant){
          const el = document.getElementById('app-splash');
          if (!el) return;
          if (instant) { el.remove(); return; }
          el.classList.add('splash-leaving');
          el.addEventListener('animationend', () => el.remove(), { once: true });
          setTimeout(() => { if (el.parentNode) el.remove(); }, 600);
        }
        // A Google/Apple OAuth sign-in redirects back to this same page with the session tokens in
        // the URL hash (see authContinueWithGoogle / authContinueWithApple's redirectTo)
        async function authFastRouteOAuthReturn(){
          const sb = getSupabaseClient();
          if (!sb) return;
          // Tells the first-frame script in index.html to stand down once routing has decided,
          // so it never paints a skeleton over the real screen.
          try {
            const { data } = await sb.auth.getSession();
            const session = data && data.session;
            if (!session || !session.user) return;
            const u = session.user;
            const created = Date.parse(u.created_at || '');
            const last = Date.parse(u.last_sign_in_at || '');
            const looksNew = isFinite(created) && isFinite(last) && Math.abs(last - created) < 60000;
            const knownReturning = !!(u.id && localStorage.getItem('stitchOnboarded:' + u.id) === '1');
            document.documentElement.classList.remove('oauth-returning');
            if (looksNew && u.email) {
              window.__stitchOAuthShownProfile = true;
              authShowCompleteProfile();
            } else if (u.email && knownReturning) {
              showAuthTransitionLoading('Signing you in', 'user', true);
            } else if (u.email) {
              // Unsure (e.g. a new device, or someone retrying an unfinished sign-up): ask first so a
              // new account never sees the skeleton before onboarding
              const needs = await authCheckNeedsProfileSetup();
              if (needs === true) {
                window.__stitchOAuthShownProfile = true;
                authShowCompleteProfile();
              } else if (needs === false) {
                showAuthTransitionLoading('Signing you in', 'user', true);
              }
            }
          } catch (e) {}
          window.__stitchAuthRouted = true;
        }
        const freshOAuthReturn = /access_token|provider_token/.test(window.location.hash || '');
        if (freshOAuthReturn) {
          // Cover the page BEFORE the splash comes off
          const earlyLanding = document.getElementById('landing-page');
          if (earlyLanding) earlyLanding.classList.add('landing-hidden');
          dismissSplash(true);
          // Returning account on this device: put the skeleton up this instant so the redirect never
          // shows a blank white page. A new sign-up gets nothing here and goes straight to onboarding
          try {
            const earlyUid = window.__stitchOAuthUid;
            if (earlyUid && localStorage.getItem('stitchOnboarded:' + earlyUid) === '1') {
              showAuthTransitionLoading('Signing you in', 'user', true);
            }
          } catch (e) {}
          // Decide right now (no waiting for window.onload / landing images) where this person
          // belongs, straight from the session that is already in the URL / local storage
          try { authFastRouteOAuthReturn(); } catch (e) {}
        } else if (window.__stitchSkipSplash) {
          // Not the first open (or returning from a sign-in / verification link): no splash
          dismissSplash(true);
        } else {
          const openedViaLink = !!(window.location.search || window.location.hash);
          setTimeout(dismissSplash, window.__stitchStandalone ? 550 : (openedViaLink ? 1000 : 2550));
        }

        window.onload = async function(){
          // A sign-up that was left before its last step never becomes an account
          if (window.__stitchFreshOAuthReturn !== true) { try { await authDiscardStalePendingOnboarding(); } catch (e) {} }
          try { await restoreSessionIfSignedIn(); } catch(e) { console.error(e); }
          // Page was reloaded while sitting on the verify-your-email screen: put them back there.
          try {
            const pendingVerifyEmail = sessionStorage.getItem(AUTH_PENDING_VERIFY_KEY);
            const gateEl = document.getElementById('auth-gate');
            if (pendingVerifyEmail && gateEl && !gateEl.classList.contains('auth-hidden') && !authIsVerifyScreenActive()) {
              authShowVerify(pendingVerifyEmail, true);
            }
          } catch (e) {}
          await Promise.all([
            loadProgress().catch(e => console.error(e)),
            loadUserNotes().catch(e => console.error(e)),
            loadRemoteGlimpses().catch(e => console.error(e)),
            loadRemotePosts().catch(e => console.error(e))
              .then(() => loadPostInteractions().catch(e => console.error(e))),
          ]);
          // Only build the app shell here if the person is already in the app. During a Google/Apple
          // return authEnterApp() builds it, and doing it here showed the Home skeleton too early.
          const gateNow = document.getElementById('auth-gate');
          const gateStillUp = !!(gateNow && !gateNow.classList.contains('auth-hidden'));
          if (!(window.__stitchFreshOAuthReturn === true && gateStillUp)) await renderApp();
        };
