// Load elements into dropdowns
async function loadElements() {

    const { data, error } = await supabase
        .from('elements')
        .select('*');

    if (error) {
        console.error("Error loading elements:", error);
        return;
    }

    const dropdown1 = document.getElementById('element1');
    const dropdown2 = document.getElementById('element2');

    dropdown1.innerHTML = "";
    dropdown2.innerHTML = "";

    data.forEach(el => {
        dropdown1.add(new Option(el.element_name, el.id));
        dropdown2.add(new Option(el.element_name, el.id));
    });
}


// Combine elements
async function combineElements() {

    const e1 = document.getElementById('element1').value;
    const e2 = document.getElementById('element2').value;

    const { data, error } = await supabase
        .from('combinations')
        .select('*')
        .or(`and(element1_id.eq.${e1},element2_id.eq.${e2}),and(element1_id.eq.${e2},element2_id.eq.${e1})`);

    if (error) {
        console.error("Error combining:", error);
        return;
    }

    if (data.length === 0) {
        document.getElementById('result').innerText = "Result: Nothing found";
        return;
    }

    const resultId = data[0].result_id;

    const { data: resultData } = await supabase
        .from('elements')
        .select('element_name')
        .eq('id', resultId)
        .single();

    document.getElementById('result').innerText = "Result: " + resultData.element_name;
}


// Run when page loads
loadElements();
